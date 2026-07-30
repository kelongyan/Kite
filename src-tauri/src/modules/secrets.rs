use std::collections::HashMap;
use std::sync::RwLock;
use tauri::{AppHandle, State};

pub struct SecretsState {
    store: RwLock<HashMap<String, String>>,
}

impl Default for SecretsState {
    fn default() -> Self {
        Self {
            store: RwLock::new(HashMap::new()),
        }
    }
}

pub fn set_secret_value(
    _app: &AppHandle,
    _state: &State<'_, SecretsState>,
    _service: &str,
    key: &str,
    value: &str,
) -> Result<(), String> {
    let _ = (key, value);
    Ok(())
}

pub fn get_secret_value(
    _app: &AppHandle,
    _state: &State<'_, SecretsState>,
    _service: &str,
    key: &str,
) -> Result<Option<String>, String> {
    let _ = key;
    Ok(None)
}

pub fn delete_secret_value(
    _app: &AppHandle,
    _state: &State<'_, SecretsState>,
    _service: &str,
    key: &str,
) -> Result<(), String> {
    let _ = key;
    Ok(())
}
