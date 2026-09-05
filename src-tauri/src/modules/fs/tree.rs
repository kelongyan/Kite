use crate::modules::workspace::{resolve_path, WorkspaceEnv};

/// Lists immediate subdirectories of `path` for the statusbar cwd breadcrumb.
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
