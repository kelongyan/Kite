mod common;

use common::FsFixture;
use kite_lib::modules::fs::tree::list_subdirs;

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
fn list_subdirs_sorts_case_insensitively() {
    let fx = FsFixture::new();
    fx.mkdir("Zeta");
    fx.mkdir("alpha");

    let dirs = list_subdirs(fx.root_str(), false, None).expect("list_subdirs");
    assert_eq!(dirs, vec!["alpha", "Zeta"]);
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
