use std::collections::HashSet;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use ignore::WalkBuilder;
use serde::Serialize;

use crate::modules::workspace::{resolve_path, WorkspaceEnv};

#[derive(Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    File,
    Dir,
    Symlink,
}

#[derive(Serialize)]
pub struct DirEntry {
    pub name: String,
    pub kind: EntryKind,
    pub size: u64,
    /// Milliseconds since UNIX epoch; 0 if unavailable.
    pub mtime: u64,
    pub gitignored: bool,
}

const MAX_GIT_FILE_BYTES: u64 = 4096;

fn read_git_path_file(path: &Path) -> Option<String> {
    let mut file = std::fs::File::open(path).ok()?;
    if file.metadata().ok()?.len() > MAX_GIT_FILE_BYTES {
        return None;
    }

    let mut contents = String::new();
    file.read_to_string(&mut contents).ok()?;
    let target = contents.lines().next()?.trim();
    if target.is_empty() {
        return None;
    }
    Some(target.to_owned())
}

fn resolve_git_path(base: &Path, target: &str) -> PathBuf {
    let target = Path::new(target);
    if target.is_absolute() {
        target.to_path_buf()
    } else {
        base.join(target)
    }
}

fn is_git_dir(path: &Path) -> bool {
    if !path.join("HEAD").is_file() {
        return false;
    }
    if path.join("objects").is_dir() {
        return true;
    }

    read_git_path_file(&path.join("commondir"))
        .map(|target| resolve_git_path(path, &target))
        .is_some_and(|common_dir| common_dir.join("objects").is_dir())
}

fn git_file_target(marker: &Path, worktree: &Path) -> Option<PathBuf> {
    let contents = read_git_path_file(marker)?;
    let target = contents.strip_prefix("gitdir: ")?.trim();
    if target.is_empty() {
        return None;
    }
    Some(resolve_git_path(worktree, target))
}

fn has_valid_git_marker(worktree: &Path) -> bool {
    let marker = worktree.join(".git");
    if marker.is_dir() {
        return is_git_dir(&marker);
    }
    if marker.is_file() {
        return git_file_target(&marker, worktree).is_some_and(|target| is_git_dir(&target));
    }
    false
}

// Whether `dir` is inside a git repo. Walks up only; never descends into
// siblings, so it does not touch protected macOS folders (Desktop, ...).
fn in_git_repo(dir: &Path) -> bool {
    let mut cur = dir;
    loop {
        if has_valid_git_marker(cur) {
            return true;
        }
        match cur.parent() {
            Some(p) => cur = p,
            None => return false,
        }
    }
}

// Immediate children of `dir` that git does not ignore. Outside a repo every
// name is returned, so nothing is dimmed.
fn git_non_ignored_names(dir: &Path, show_hidden: bool) -> HashSet<String> {
    WalkBuilder::new(dir)
        .hidden(!show_hidden)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .ignore(false)
        .parents(true)
        .max_depth(Some(1))
        .follow_links(false)
        .build()
        .flatten()
        .filter_map(|d| d.file_name().to_str().map(str::to_string))
        .collect()
}

/// Lists immediate children of `path`. Dirs first, then files, each sorted
/// case-insensitively. Dot-prefixed entries (files and dirs) are hidden unless
/// `show_hidden` is set. `git_decorations` opts into the per-entry `gitignored`
/// flag; off by default so non-explorer callers pay nothing.
#[tauri::command]
pub fn fs_read_dir(
    path: String,
    show_hidden: bool,
    git_decorations: Option<bool>,
    workspace: Option<WorkspaceEnv>,
) -> Result<Vec<DirEntry>, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let root = resolve_path(&path, &workspace);
    let read = std::fs::read_dir(&root).map_err(|e| {
        log::debug!("fs_read_dir({}) failed: {e}", root.display());
        e.to_string()
    })?;

    // Gate on a real repo: outside one the walk is pointless and would probe
    // each child for a nested `.git`, which trips macOS folder-access prompts.
    let git_decorations = git_decorations.unwrap_or(false) && in_git_repo(&root);
    let git_visible = if git_decorations {
        git_non_ignored_names(&root, show_hidden)
    } else {
        HashSet::new()
    };

    let mut entries: Vec<DirEntry> = read
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let name = entry.file_name().into_string().ok()?;

            // `metadata()` follows symlinks → it returns the target's stat in
            // one syscall (file_type + size + mtime all derived from it). We
            // fall back to `symlink_metadata` for broken symlinks so we don't
            // silently drop them from the listing.
            let (meta, was_symlink) = match std::fs::metadata(entry.path()) {
                Ok(m) => (Some(m), false),
                Err(_) => (entry.metadata().ok(), true),
            };
            let meta = meta?;

            let kind = if was_symlink {
                EntryKind::Symlink
            } else if meta.is_dir() {
                EntryKind::Dir
            } else {
                EntryKind::File
            };

            if name.starts_with('.') && !show_hidden {
                return None;
            }

            let size = meta.len();
            let mtime = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);

            let gitignored = git_decorations && !git_visible.contains(&name);
            Some(DirEntry {
                name,
                kind,
                size,
                mtime,
                gitignored,
            })
        })
        .collect();

    entries.sort_by(|a, b| {
        let rank = |k: &EntryKind| match k {
            EntryKind::Dir => 0,
            EntryKind::Symlink => 1,
            EntryKind::File => 2,
        };
        rank(&a.kind)
            .cmp(&rank(&b.kind))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

/// Lists immediate subdirectories of `path`. Kept for the CwdBreadcrumb.
///
/// Symlinks to directories are included (matches shell `cd` semantics).
/// Hidden entries are filtered by dot-prefix only.
#[tauri::command]
pub fn list_subdirs(
    path: String,
    show_hidden: bool,
    workspace: Option<WorkspaceEnv>,
) -> Result<Vec<String>, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let root = resolve_path(&path, &workspace);
    let read = std::fs::read_dir(&root).map_err(|e| {
        log::debug!("list_subdirs({}) read_dir failed: {e}", root.display());
        e.to_string()
    })?;

    let mut dirs: Vec<String> = read
        .filter_map(Result::ok)
        .filter(|entry| match entry.file_type() {
            Ok(t) if t.is_dir() => true,
            Ok(t) if t.is_symlink() => std::fs::metadata(entry.path())
                .map(|m| m.is_dir())
                .unwrap_or(false),
            _ => false,
        })
        .filter_map(|entry| entry.file_name().into_string().ok())
        .filter(|name| show_hidden || !name.starts_with('.'))
        .collect();

    dirs.sort_by_key(|a| a.to_lowercase());
    Ok(dirs)
}

#[cfg(test)]
mod tests {
    use super::in_git_repo;
    use std::path::Path;

    fn write_regular_git_dir(path: &Path) {
        std::fs::create_dir_all(path.join("objects")).expect("create objects");
        std::fs::write(path.join("HEAD"), "ref: refs/heads/main\n").expect("write HEAD");
    }

    #[test]
    fn empty_dot_git_directory_is_not_a_repo() {
        let root = tempfile::tempdir().expect("tempdir");
        std::fs::create_dir(root.path().join(".git")).expect("create .git");
        let nested = root.path().join("nested");
        std::fs::create_dir(&nested).expect("create nested");

        assert!(!in_git_repo(&nested));
    }

    #[test]
    fn regular_dot_git_directory_is_a_repo() {
        let root = tempfile::tempdir().expect("tempdir");
        write_regular_git_dir(&root.path().join(".git"));
        let nested = root.path().join("nested");
        std::fs::create_dir(&nested).expect("create nested");

        assert!(in_git_repo(&nested));
    }

    #[test]
    fn submodule_style_git_file_is_a_repo() {
        let root = tempfile::tempdir().expect("tempdir");
        let worktree = root.path().join("checkout");
        let git_dir = root.path().join("module-git-dir");
        std::fs::create_dir(&worktree).expect("create checkout");
        write_regular_git_dir(&git_dir);
        std::fs::write(worktree.join(".git"), "gitdir: ../module-git-dir\n")
            .expect("write .git file");

        assert!(in_git_repo(&worktree));
    }

    #[test]
    fn worktree_style_git_file_is_a_repo() {
        let root = tempfile::tempdir().expect("tempdir");
        let worktree = root.path().join("checkout");
        let common_dir = root.path().join("repo.git");
        let git_dir = root.path().join("repo.git/worktrees/topic");
        std::fs::create_dir(&worktree).expect("create checkout");
        std::fs::create_dir_all(common_dir.join("objects")).expect("create common objects");
        std::fs::create_dir_all(&git_dir).expect("create worktree git dir");
        std::fs::write(git_dir.join("HEAD"), "ref: refs/heads/topic\n").expect("write HEAD");
        std::fs::write(git_dir.join("commondir"), "../..\n").expect("write commondir");
        std::fs::write(
            worktree.join(".git"),
            "gitdir: ../repo.git/worktrees/topic\n",
        )
        .expect("write .git file");

        assert!(in_git_repo(&worktree));
    }

    #[test]
    fn worktree_style_git_file_requires_a_valid_common_dir() {
        let root = tempfile::tempdir().expect("tempdir");
        let worktree = root.path().join("checkout");
        let git_dir = root.path().join("repo.git/worktrees/topic");
        std::fs::create_dir(&worktree).expect("create checkout");
        std::fs::create_dir_all(&git_dir).expect("create worktree git dir");
        std::fs::write(git_dir.join("HEAD"), "ref: refs/heads/topic\n").expect("write HEAD");
        std::fs::write(git_dir.join("commondir"), "../..\n").expect("write commondir");
        std::fs::write(
            worktree.join(".git"),
            "gitdir: ../repo.git/worktrees/topic\n",
        )
        .expect("write .git file");

        assert!(!in_git_repo(&worktree));
    }
}
