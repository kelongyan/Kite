mod common;

use common::{git_available, GitRepoFixture};
use kite_lib::modules::fs::to_canon;
use kite_lib::modules::git::errors::GitError;
use kite_lib::modules::git::operations;
use kite_lib::modules::git::types::DiscardEntry;
use kite_lib::modules::workspace::{WorkspaceEnv, WorkspaceRegistry};
use tempfile::TempDir;

fn skip_if_no_git() -> bool {
    if !git_available() {
        eprintln!("skipping: git not on PATH");
        return true;
    }
    false
}

#[test]
fn resolve_repo_returns_none_outside_repo() {
    if skip_if_no_git() {
        return;
    }
    let tmp = TempDir::new().unwrap();
    let canonical = std::fs::canonicalize(tmp.path()).unwrap();
    let registry = WorkspaceRegistry::default();
    registry.authorize(&canonical).unwrap();

    let info = operations::resolve_repo(&registry, &to_canon(&canonical), &WorkspaceEnv::Local)
        .expect("resolve_repo");
    assert!(info.is_none());
}

#[test]
fn resolve_repo_returns_branch_for_real_repo() {
    if skip_if_no_git() {
        return;
    }
    let fx = GitRepoFixture::new();
    fx.write_file("seed.txt", "seed\n");
    fx.run_git(&["add", "seed.txt"]);
    fx.run_git(&["commit", "-q", "-m", "seed"]);

    let info = operations::resolve_repo(&fx.registry, &fx.repo_str(), &fx.workspace)
        .expect("resolve_repo")
        .expect("repo present");
    assert_eq!(info.branch, "main");
    assert!(info.upstream.is_none());
    assert!(!info.is_detached);
}

#[test]
fn resolve_repo_returns_branch_for_unborn_head() {
    if skip_if_no_git() {
        return;
    }
    let fx = GitRepoFixture::new();
    let info = operations::resolve_repo(&fx.registry, &fx.repo_str(), &fx.workspace)
        .expect("resolve_repo")
        .expect("repo present even without commits");
    assert_eq!(info.branch, "main");
    assert!(info.upstream.is_none());
    assert!(!info.is_detached);
}

#[test]
fn status_on_empty_repo_has_no_files() {
    if skip_if_no_git() {
        return;
    }
    let fx = GitRepoFixture::new();
    let snap = operations::status(&fx.registry, &fx.repo_str(), &fx.workspace).expect("status");
    assert_eq!(snap.branch, "main");
    assert!(snap.changed_files.is_empty());
    assert_eq!(snap.ahead, 0);
    assert_eq!(snap.behind, 0);
}

#[test]
fn status_lists_untracked_file() {
    if skip_if_no_git() {
        return;
    }
    let fx = GitRepoFixture::new();
    fx.write_file("hello.txt", "hi\n");
    let snap = operations::status(&fx.registry, &fx.repo_str(), &fx.workspace).expect("status");
    let entry = snap
        .changed_files
        .iter()
        .find(|f| f.path == "hello.txt")
        .expect("hello.txt in changed_files");
    assert!(entry.untracked);
    assert!(!entry.staged);
}

#[test]
fn stage_then_commit_returns_commit_summary() {
    if skip_if_no_git() {
        return;
    }
    let fx = GitRepoFixture::new();
    fx.write_file("a.txt", "alpha\n");
    operations::stage(
        &fx.registry,
        &fx.repo_str(),
        &["a.txt".into()],
        &fx.workspace,
    )
    .expect("stage");

    let snap = operations::status(&fx.registry, &fx.repo_str(), &fx.workspace).unwrap();
    let entry = snap
        .changed_files
        .iter()
        .find(|f| f.path == "a.txt")
        .expect("a.txt staged");
    assert!(entry.staged);
    assert!(!entry.untracked);

    let commit =
        operations::commit(&fx.registry, &fx.repo_str(), "add a", &fx.workspace).expect("commit");
    assert_eq!(commit.summary, "add a");
    assert_eq!(commit.commit_sha.len(), 40);
}

#[test]
fn unstage_clears_index_entry() {
    if skip_if_no_git() {
        return;
    }
    let fx = GitRepoFixture::new();
    fx.write_file("a.txt", "alpha\n");
    fx.run_git(&["add", "a.txt"]);
    fx.run_git(&["commit", "-q", "-m", "init"]);
    fx.write_file("a.txt", "beta\n");
    operations::stage(
        &fx.registry,
        &fx.repo_str(),
        &["a.txt".into()],
        &fx.workspace,
    )
    .unwrap();

    operations::unstage(
        &fx.registry,
        &fx.repo_str(),
        &["a.txt".into()],
        &fx.workspace,
    )
    .expect("unstage");

    let snap = operations::status(&fx.registry, &fx.repo_str(), &fx.workspace).unwrap();
    let entry = snap
        .changed_files
        .iter()
        .find(|f| f.path == "a.txt")
        .expect("a.txt present");
    assert!(!entry.staged);
    assert!(entry.unstaged);
}

#[test]
fn commit_with_empty_message_is_rejected() {
    if skip_if_no_git() {
        return;
    }
    let fx = GitRepoFixture::new();
    fx.write_file("a.txt", "alpha\n");
    fx.run_git(&["add", "a.txt"]);

    match operations::commit(&fx.registry, &fx.repo_str(), "   ", &fx.workspace) {
        Err(GitError::EmptyCommitMessage) => {}
        Err(other) => panic!("expected EmptyCommitMessage, got {other}"),
        Ok(_) => panic!("expected error for empty message"),
    }
}

#[test]
fn discard_tracked_restores_worktree() {
    if skip_if_no_git() {
        return;
    }
    let fx = GitRepoFixture::new();
    fx.write_file("a.txt", "alpha\n");
    fx.run_git(&["add", "a.txt"]);
    fx.run_git(&["commit", "-q", "-m", "init"]);
    fx.write_file("a.txt", "tampered\n");

    operations::discard(
        &fx.registry,
        &fx.repo_str(),
        &[DiscardEntry {
            path: "a.txt".into(),
            untracked: false,
        }],
        &fx.workspace,
    )
    .expect("discard");

    let content = std::fs::read_to_string(fx.repo_path.join("a.txt")).unwrap();
    assert_eq!(content, "alpha\n");
}

#[test]
fn discard_untracked_removes_file() {
    if skip_if_no_git() {
        return;
    }
    let fx = GitRepoFixture::new();
    fx.write_file("garbage.txt", "junk\n");

    operations::discard(
        &fx.registry,
        &fx.repo_str(),
        &[DiscardEntry {
            path: "garbage.txt".into(),
            untracked: true,
        }],
        &fx.workspace,
    )
    .expect("discard");

    assert!(!fx.repo_path.join("garbage.txt").exists());
}

#[test]
fn panel_snapshot_returns_repo_and_status_after_commit() {
    if skip_if_no_git() {
        return;
    }
    let fx = GitRepoFixture::new();
    fx.write_file("a.txt", "alpha\n");
    fx.run_git(&["add", "a.txt"]);
    fx.run_git(&["commit", "-q", "-m", "seed"]);
    fx.write_file("b.txt", "beta\n");

    let snap = operations::panel_snapshot(&fx.registry, &fx.repo_str(), &fx.workspace)
        .expect("panel_snapshot");
    let repo = snap.repo.expect("repo present");
    assert_eq!(repo.branch, "main");
    let status = snap.status.expect("status present");
    assert!(status.changed_files.iter().any(|f| f.path == "b.txt"));
}

#[test]
fn panel_snapshot_outside_repo_is_empty() {
    if skip_if_no_git() {
        return;
    }
    let tmp = TempDir::new().unwrap();
    let canonical = std::fs::canonicalize(tmp.path()).unwrap();
    let registry = WorkspaceRegistry::default();
    registry.authorize(&canonical).unwrap();

    let snap = operations::panel_snapshot(&registry, &to_canon(&canonical), &WorkspaceEnv::Local)
        .expect("panel_snapshot");
    assert!(snap.repo.is_none());
    assert!(snap.status.is_none());
}

#[test]
fn unauthorized_path_is_rejected() {
    if skip_if_no_git() {
        return;
    }
    let tmp = TempDir::new().unwrap();
    let canonical = std::fs::canonicalize(tmp.path()).unwrap();
    let registry = WorkspaceRegistry::default();

    match operations::status(&registry, &to_canon(&canonical), &WorkspaceEnv::Local) {
        Err(GitError::PathOutsideWorkspace(_)) => {}
        Err(other) => panic!("expected PathOutsideWorkspace, got {other}"),
        Ok(_) => panic!("expected error for unauthorized dir"),
    }
}

#[test]
fn checkout_branch_rejects_unsafe_names() {
    if skip_if_no_git() {
        return;
    }
    let fx = GitRepoFixture::new();

    let err_empty =
        operations::checkout_branch(&fx.registry, &fx.repo_str(), "", &fx.workspace).unwrap_err();
    assert!(matches!(err_empty, GitError::InvalidPath(p) if p.is_empty()));

    let err_dash =
        operations::checkout_branch(&fx.registry, &fx.repo_str(), "-f", &fx.workspace).unwrap_err();
    assert!(matches!(err_dash, GitError::InvalidPath(p) if p == "-f"));

    let err_dash_long =
        operations::checkout_branch(&fx.registry, &fx.repo_str(), "--detach", &fx.workspace)
            .unwrap_err();
    assert!(matches!(err_dash_long, GitError::InvalidPath(p) if p == "--detach"));
}

#[test]
fn list_branches_keeps_current_branch_local_and_surfaces_worktrees() {
    if skip_if_no_git() {
        return;
    }
    let fx = GitRepoFixture::new();
    fx.write_file("a.txt", "a\n");
    fx.run_git(&["add", "."]);
    fx.run_git(&["commit", "-q", "-m", "init"]);
    fx.run_git(&["branch", "feature"]);

    let wt = TempDir::new().unwrap();
    let wt_path = wt.path().join("linked");
    fx.run_git(&[
        "worktree",
        "add",
        "-q",
        wt_path.to_str().unwrap(),
        "feature",
    ]);

    let result = operations::list_branches(&fx.registry, &fx.repo_str(), &fx.workspace)
        .expect("list_branches");

    // current branch stays local+head despite the main worktree being listed
    let main = result
        .branches
        .iter()
        .find(|b| b.name == "main")
        .expect("main branch present");
    assert_eq!(main.kind, "local");
    assert!(main.is_head);
    assert!(main.worktree_path.is_none());

    let feature: Vec<_> = result
        .branches
        .iter()
        .filter(|b| b.name == "feature")
        .collect();
    assert_eq!(feature.len(), 1);
    assert_eq!(feature[0].kind, "worktree");
    assert!(!feature[0].is_head);
    assert!(feature[0].worktree_path.is_some());
}
