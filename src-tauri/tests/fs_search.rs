mod common;

use common::{git_available, FsFixture, GitRepoFixture};
use kite_lib::modules::fs::search::fs_search;
use kite_lib::modules::fs::tree::{fs_read_dir, list_subdirs, EntryKind};

#[test]
fn search_substring_matches_filename() {
    let fx = FsFixture::new();
    fx.write("src/main.rs", "");
    fx.write("src/lib.rs", "");
    fx.write("docs/main.md", "");

    let res = fs_search(fx.root_str(), "main".into(), None, None, None).expect("search");
    let rels: Vec<&str> = res.hits.iter().map(|h| h.rel.as_str()).collect();
    assert!(rels.contains(&"src/main.rs"));
    assert!(rels.contains(&"docs/main.md"));
    assert!(!rels.contains(&"src/lib.rs"));
}

#[test]
fn search_is_case_insensitive() {
    let fx = FsFixture::new();
    fx.write("README.md", "");
    let res = fs_search(fx.root_str(), "readme".into(), None, None, None).expect("search");
    assert_eq!(res.hits.len(), 1);
}

#[test]
fn search_empty_query_returns_empty() {
    let fx = FsFixture::new();
    fx.write("a.txt", "");
    let res = fs_search(fx.root_str(), "   ".into(), None, None, None).expect("search");
    assert!(res.hits.is_empty());
    assert!(!res.truncated);
}

#[test]
fn search_prunes_node_modules() {
    let fx = FsFixture::new();
    fx.write("node_modules/lodash/index.js", "");
    fx.write("src/index.js", "");

    let res = fs_search(fx.root_str(), "index".into(), None, None, None).expect("search");
    let rels: Vec<&str> = res.hits.iter().map(|h| h.rel.as_str()).collect();
    assert!(rels.iter().any(|r| r.starts_with("src/")));
    assert!(!rels.iter().any(|r| r.starts_with("node_modules")));
}

#[test]
fn search_ranks_filename_hits_before_path_hits() {
    let fx = FsFixture::new();
    fx.write("zeta/inner.txt", "");
    fx.write("beta/zeta.txt", "");

    let res = fs_search(fx.root_str(), "zeta".into(), None, None, None).expect("search");
    let zeta_file = res
        .hits
        .iter()
        .position(|h| h.rel == "beta/zeta.txt")
        .expect("file hit");
    let inner_file = res
        .hits
        .iter()
        .position(|h| h.rel == "zeta/inner.txt")
        .expect("path-only hit");
    assert!(
        zeta_file < inner_file,
        "filename hit should rank before path-only hit",
    );
}

#[test]
fn read_dir_orders_dirs_before_files_then_alpha() {
    let fx = FsFixture::new();
    fx.mkdir("zdir");
    fx.mkdir("adir");
    fx.write("zfile.txt", "");
    fx.write("afile.txt", "");

    let entries = fs_read_dir(fx.root_str(), false, None, None).expect("read_dir");
    let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
    assert_eq!(names, vec!["adir", "zdir", "afile.txt", "zfile.txt"]);
    assert!(matches!(entries[0].kind, EntryKind::Dir));
    assert!(matches!(entries[2].kind, EntryKind::File));
}

#[test]
fn read_dir_hides_dotfiles_by_default() {
    let fx = FsFixture::new();
    fx.write(".secret", "");
    fx.write("visible.txt", "");

    let hidden_off = fs_read_dir(fx.root_str(), false, None, None).expect("read_dir");
    let names: Vec<&str> = hidden_off.iter().map(|e| e.name.as_str()).collect();
    assert_eq!(names, vec!["visible.txt"]);

    let hidden_on = fs_read_dir(fx.root_str(), true, None, None).expect("read_dir");
    let names: Vec<&str> = hidden_on.iter().map(|e| e.name.as_str()).collect();
    assert!(names.contains(&".secret"));
}

#[test]
fn read_dir_flags_gitignored_entries_only_when_requested() {
    if !git_available() {
        return;
    }
    let fx = GitRepoFixture::new();
    fx.write_file(".gitignore", "ignored.txt\nbuild/\n");
    fx.write_file("kept.txt", "");
    fx.write_file("ignored.txt", "");
    fx.write_file("build/out.o", "");

    let entries = fs_read_dir(fx.repo_str(), false, Some(true), None).expect("read_dir");
    let flag = |name: &str| {
        entries
            .iter()
            .find(|e| e.name == name)
            .unwrap_or_else(|| panic!("{name} missing"))
            .gitignored
    };
    assert!(!flag("kept.txt"));
    assert!(flag("ignored.txt"));
    assert!(flag("build"));

    let plain = fs_read_dir(fx.repo_str(), false, None, None).expect("read_dir");
    assert!(plain.iter().all(|e| !e.gitignored));
}

#[test]
fn read_dir_skips_gitignore_outside_a_repo() {
    let fx = FsFixture::new();
    fx.write(".gitignore", "ignored.txt\n");
    fx.write("ignored.txt", "");
    fx.write("kept.txt", "");
    let entries = fs_read_dir(fx.root_str(), false, Some(true), None).expect("read_dir");
    assert!(entries.iter().all(|e| !e.gitignored));
}

#[test]
fn read_dir_does_not_treat_empty_dot_git_directory_as_repo() {
    let fx = FsFixture::new();
    fx.mkdir(".git");
    fx.write(".gitignore", "ignored.txt\n");
    fx.write("ignored.txt", "");

    let entries = fs_read_dir(fx.root_str(), false, Some(true), None).expect("read_dir");
    assert!(entries.iter().all(|entry| !entry.gitignored));
}

#[test]
fn read_dir_flags_gitignored_entries_in_a_linked_worktree() {
    if !git_available() {
        return;
    }
    let fx = GitRepoFixture::new();
    fx.write_file(".gitignore", "ignored.txt\n");
    fx.write_file("seed.txt", "");
    fx.run_git(&["add", "."]);
    fx.run_git(&["commit", "-q", "-m", "seed"]);

    let worktree_parent = tempfile::tempdir().expect("tempdir");
    let worktree = worktree_parent.path().join("linked");
    fx.run_git(&[
        "worktree",
        "add",
        "-q",
        "-b",
        "feature",
        worktree.to_str().expect("UTF-8 worktree path"),
    ]);
    std::fs::write(worktree.join("ignored.txt"), "").expect("write ignored file");

    let entries = fs_read_dir(
        worktree.to_string_lossy().into_owned(),
        false,
        Some(true),
        None,
    )
    .expect("read_dir");
    let ignored = entries
        .iter()
        .find(|entry| entry.name == "ignored.txt")
        .expect("ignored.txt entry");
    assert!(ignored.gitignored);
}

#[test]
fn read_dir_returns_size_for_files() {
    let fx = FsFixture::new();
    fx.write("known.txt", "abcdef");

    let entries = fs_read_dir(fx.root_str(), false, None, None).expect("read_dir");
    let entry = entries.iter().find(|e| e.name == "known.txt").unwrap();
    assert_eq!(entry.size, 6);
    assert!(matches!(entry.kind, EntryKind::File));
}

#[test]
fn list_subdirs_returns_only_directories() {
    let fx = FsFixture::new();
    fx.mkdir("dir_a");
    fx.mkdir("dir_b");
    fx.write("not_a_dir.txt", "");

    let dirs = list_subdirs(fx.root_str(), false, None).expect("list_subdirs");
    assert_eq!(dirs, vec!["dir_a", "dir_b"]);
}

#[test]
fn list_subdirs_hides_dot_dirs_by_default() {
    let fx = FsFixture::new();
    fx.mkdir(".hidden");
    fx.mkdir("visible");

    let off = list_subdirs(fx.root_str(), false, None).expect("list_subdirs");
    assert_eq!(off, vec!["visible"]);

    let on = list_subdirs(fx.root_str(), true, None).expect("list_subdirs");
    assert!(on.contains(&".hidden".to_string()));
}
