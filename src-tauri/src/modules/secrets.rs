use tauri::AppHandle;

#[cfg(target_os = "linux")]
use std::collections::HashMap;
#[cfg(target_os = "linux")]
use std::fs;
#[cfg(target_os = "linux")]
use std::path::PathBuf;
#[cfg(target_os = "linux")]
use std::sync::Mutex;
#[cfg(target_os = "linux")]
use tauri::Manager;

#[derive(Default)]
pub struct SecretsState {
    #[cfg(target_os = "linux")]
    cache: Mutex<Option<HashMap<String, String>>>,
}

#[cfg(target_os = "linux")]
fn key(service: &str, account: &str) -> String {
    format!("{service}::{account}")
}

#[cfg(target_os = "linux")]
fn store_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("secrets.json"))
}

#[cfg(target_os = "linux")]
fn read_store_at(path: &std::path::Path) -> Result<HashMap<String, String>, String> {
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    serde_json::from_slice(&bytes).map_err(|e| e.to_string())
}

#[cfg(target_os = "linux")]
fn write_store_at(
    path: &std::path::Path,
    values: &HashMap<String, String>,
) -> Result<(), String> {
    use std::io::Write;
    use std::os::unix::fs::OpenOptionsExt;

    let tmp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec(values).map_err(|e| e.to_string())?;
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(&tmp)
        .map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    fs::rename(tmp, path).map_err(|e| e.to_string())
}

#[cfg(target_os = "linux")]
fn with_store<R>(
    app: &AppHandle,
    state: &SecretsState,
    update: impl FnOnce(&mut HashMap<String, String>) -> R,
) -> Result<R, String> {
    let mut guard = state.cache.lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        *guard = Some(read_store_at(&store_path(app)?)?);
    }
    Ok(update(guard.as_mut().expect("secret cache initialized")))
}

#[cfg(not(target_os = "linux"))]
fn entry(service: &str, account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(service, account).map_err(|e| e.to_string())
}

pub fn set_secret_value(
    app: &AppHandle,
    state: &SecretsState,
    service: &str,
    account: &str,
    value: &str,
) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let key = key(service, account);
        with_store(app, state, |values| {
            values.insert(key, value.to_string());
        })?;
        let snapshot = state
            .cache
            .lock()
            .map_err(|e| e.to_string())?
            .as_ref()
            .cloned()
            .unwrap_or_default();
        write_store_at(&store_path(app)?, &snapshot)
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, state);
        entry(service, account)?
            .set_password(value)
            .map_err(|e| e.to_string())
    }
}

pub fn get_secret_value(
    app: &AppHandle,
    state: &SecretsState,
    service: &str,
    account: &str,
) -> Result<Option<String>, String> {
    #[cfg(target_os = "linux")]
    {
        let key = key(service, account);
        with_store(app, state, |values| values.get(&key).cloned())
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, state);
        match entry(service, account)?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(error.to_string()),
        }
    }
}

pub fn delete_secret_value(
    app: &AppHandle,
    state: &SecretsState,
    service: &str,
    account: &str,
) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let key = key(service, account);
        with_store(app, state, |values| {
            values.remove(&key);
        })?;
        let snapshot = state
            .cache
            .lock()
            .map_err(|e| e.to_string())?
            .as_ref()
            .cloned()
            .unwrap_or_default();
        write_store_at(&store_path(app)?, &snapshot)
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, state);
        match entry(service, account)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error.to_string()),
        }
    }
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    use std::os::unix::fs::MetadataExt;
    use tempfile::TempDir;

    #[test]
    fn file_store_round_trips_and_is_user_only() {
        let temp = TempDir::new().unwrap();
        let path = temp.path().join("secrets.json");
        let mut values = HashMap::new();
        values.insert(key("kite-sftp", "profile:password"), "secret".into());

        write_store_at(&path, &values).unwrap();

        assert_eq!(read_store_at(&path).unwrap(), values);
        assert_eq!(fs::metadata(path).unwrap().mode() & 0o777, 0o600);
    }

    #[test]
    fn missing_store_is_empty() {
        let temp = TempDir::new().unwrap();
        assert!(read_store_at(&temp.path().join("missing.json"))
            .unwrap()
            .is_empty());
    }
}
