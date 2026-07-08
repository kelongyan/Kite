use std::path::{Path, PathBuf};

use crate::modules::workspace::{resolve_path, WorkspaceEnv, WorkspaceRegistry};

pub fn validate_remote_path(path: &str) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("remote path is required".into());
    }
    if path.contains('\0') {
        return Err("remote path cannot contain NUL bytes".into());
    }
    if !path.starts_with('/') {
        return Err("remote path must be absolute".into());
    }
    Ok(())
}

pub fn join_remote_path(parent: &str, name: &str) -> Result<String, String> {
    validate_remote_path(parent)?;
    if name.trim().is_empty() || name.contains('/') || name.contains('\\') || name.contains('\0') {
        return Err("remote name must be a single path segment".into());
    }
    let base = parent.trim_end_matches('/');
    Ok(if base.is_empty() {
        format!("/{name}")
    } else {
        format!("{base}/{name}")
    })
}

pub fn remote_basename(path: &str) -> Result<String, String> {
    validate_remote_path(path)?;
    path.trim_end_matches('/')
        .rsplit('/')
        .next()
        .filter(|name| !name.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "remote path has no file name".into())
}

pub fn remote_dirname(path: &str) -> Result<String, String> {
    validate_remote_path(path)?;
    let trimmed = path.trim_end_matches('/');
    let Some(idx) = trimmed.rfind('/') else {
        return Err("remote path has no parent".into());
    };
    Ok(if idx == 0 {
        "/".into()
    } else {
        trimmed[..idx].into()
    })
}

pub fn remote_temp_path(target: &str, transfer_id: &str) -> Result<String, String> {
    let parent = remote_dirname(target)?;
    let base = remote_basename(target)?;
    join_remote_path(&parent, &format!(".{base}.{transfer_id}.tmp"))
}

pub fn remote_partial_path(target: &str) -> Result<String, String> {
    let parent = remote_dirname(target)?;
    let base = remote_basename(target)?;
    join_remote_path(&parent, &format!(".{base}.kitepart"))
}

pub fn local_partial_path(target: &Path) -> Result<PathBuf, String> {
    let parent = target
        .parent()
        .ok_or_else(|| "local target has no parent directory".to_string())?;
    let name = target
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "local target has no safe file name".to_string())?;
    Ok(parent.join(format!(".{name}.kitepart")))
}

pub fn authorize_existing_local_file(
    raw: &str,
    workspace: &WorkspaceEnv,
    registry: &WorkspaceRegistry,
) -> Result<PathBuf, String> {
    let canonical = authorize_existing_local_entry(raw, workspace, registry)?;
    if !canonical.is_file() {
        return Err(format!(
            "local source is not a file: {}",
            canonical.display()
        ));
    }
    Ok(canonical)
}

pub fn authorize_existing_local_entry(
    raw: &str,
    workspace: &WorkspaceEnv,
    registry: &WorkspaceRegistry,
) -> Result<PathBuf, String> {
    let resolved = resolve_path(raw, workspace);
    let canonical = std::fs::canonicalize(&resolved).map_err(|e| e.to_string())?;
    if !canonical.is_file() && !canonical.is_dir() {
        return Err(format!(
            "local source is not a file or directory: {}",
            canonical.display()
        ));
    }
    if !registry.is_authorized(&canonical) {
        return Err(format!(
            "local source is outside the authorized workspace: {}",
            canonical.display()
        ));
    }
    Ok(canonical)
}

pub fn authorize_existing_local_dir(
    raw: &str,
    workspace: &WorkspaceEnv,
    registry: &WorkspaceRegistry,
) -> Result<PathBuf, String> {
    let canonical = authorize_existing_local_entry(raw, workspace, registry)?;
    if !canonical.is_dir() {
        return Err(format!(
            "local target parent is not a directory: {}",
            canonical.display()
        ));
    }
    Ok(canonical)
}

pub fn authorize_local_write_target(
    raw: &str,
    workspace: &WorkspaceEnv,
    registry: &WorkspaceRegistry,
) -> Result<PathBuf, String> {
    let resolved = resolve_path(raw, workspace);
    if resolved.exists() {
        if resolved.is_dir() {
            return Err(format!(
                "local target is a directory: {}",
                resolved.display()
            ));
        }
        return Err(format!(
            "local target already exists: {}",
            resolved.display()
        ));
    }
    let parent = resolved
        .parent()
        .ok_or_else(|| "local target has no parent directory".to_string())?;
    let canonical_parent = std::fs::canonicalize(parent).map_err(|e| e.to_string())?;
    if !canonical_parent.is_dir() {
        return Err(format!(
            "local target parent is not a directory: {}",
            canonical_parent.display()
        ));
    }
    if !registry.is_authorized(&canonical_parent) {
        return Err(format!(
            "local target is outside the authorized workspace: {}",
            canonical_parent.display()
        ));
    }
    let name = resolved
        .file_name()
        .ok_or_else(|| "local target has no file name".to_string())?;
    Ok(Path::new(&canonical_parent).join(name))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::workspace::WorkspaceRegistry;

    #[test]
    fn remote_path_must_be_absolute_and_nul_free() {
        assert!(validate_remote_path("/home/app").is_ok());
        assert!(validate_remote_path("home/app").is_err());
        assert!(validate_remote_path("/home\0/app").is_err());
    }

    #[test]
    fn remote_join_keeps_paths_absolute() {
        assert_eq!(join_remote_path("/", "app.log").unwrap(), "/app.log");
        assert_eq!(
            join_remote_path("/home/deploy", "app.log").unwrap(),
            "/home/deploy/app.log"
        );
        assert!(join_remote_path("/home/deploy", "../app.log").is_err());
        assert!(join_remote_path("/home/deploy", "nested/app.log").is_err());
    }

    #[test]
    fn remote_temp_path_uses_hidden_file_in_same_dir() {
        assert_eq!(
            remote_temp_path("/home/deploy/app.zip", "transfer-1").unwrap(),
            "/home/deploy/.app.zip.transfer-1.tmp"
        );
    }

    #[test]
    fn partial_paths_are_stable_for_resume() {
        assert_eq!(
            remote_partial_path("/home/deploy/app.zip").unwrap(),
            "/home/deploy/.app.zip.kitepart"
        );
        assert_eq!(
            local_partial_path(Path::new("C:/repo/app.zip")).unwrap(),
            PathBuf::from("C:/repo/.app.zip.kitepart")
        );
    }

    #[test]
    fn local_write_target_must_stay_under_authorized_parent() {
        let dir = tempfile::tempdir().unwrap();
        let registry = WorkspaceRegistry::default();
        registry.authorize(dir.path()).unwrap();
        let target = dir.path().join("out.txt");
        let path = authorize_local_write_target(
            &target.to_string_lossy(),
            &WorkspaceEnv::Local,
            &registry,
        )
        .unwrap();
        assert_eq!(path.file_name(), target.file_name());
        assert!(path.starts_with(dir.path().canonicalize().unwrap()));
    }

    #[test]
    fn local_write_target_refuses_existing_file() {
        let dir = tempfile::tempdir().unwrap();
        let registry = WorkspaceRegistry::default();
        registry.authorize(dir.path()).unwrap();
        let target = dir.path().join("out.txt");
        std::fs::write(&target, "existing").unwrap();

        let err = authorize_local_write_target(
            &target.to_string_lossy(),
            &WorkspaceEnv::Local,
            &registry,
        )
        .expect_err("existing target must fail");

        assert!(err.contains("already exists"), "got: {err}");
    }

    #[test]
    fn local_existing_dir_must_stay_under_authorized_workspace() {
        let dir = tempfile::tempdir().unwrap();
        let registry = WorkspaceRegistry::default();
        registry.authorize(dir.path()).unwrap();

        let path = authorize_existing_local_dir(
            &dir.path().to_string_lossy(),
            &WorkspaceEnv::Local,
            &registry,
        )
        .unwrap();

        assert_eq!(path, dir.path().canonicalize().unwrap());
    }
}
