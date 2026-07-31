mod common;

use common::FsFixture;
use kite_lib::modules::fs::tree::{fs_read_dir, list_subdirs, EntryKind};

#[test]
fn read_dir_orders_dirs_before_files_then_alpha() {
    let fx = FsFixture::new();
    fx.mkdir("zdir");
    fx.mkdir("adir");
    fx.write("zfile.txt", "");
    fx.write("afile.txt", "");

    let entries = fs_read_dir(fx.root_str(), false, None).expect("read_dir");
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

    let hidden_off = fs_read_dir(fx.root_str(), false, None).expect("read_dir");
    let names: Vec<&str> = hidden_off.iter().map(|e| e.name.as_str()).collect();
    assert_eq!(names, vec!["visible.txt"]);

    let hidden_on = fs_read_dir(fx.root_str(), true, None).expect("read_dir");
    let names: Vec<&str> = hidden_on.iter().map(|e| e.name.as_str()).collect();
    assert!(names.contains(&".secret"));
}

#[test]
fn read_dir_returns_size_for_files() {
    let fx = FsFixture::new();
    fx.write("known.txt", "abcdef");

    let entries = fs_read_dir(fx.root_str(), false, None).expect("read_dir");
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
