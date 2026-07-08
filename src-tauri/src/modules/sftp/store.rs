use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};
use tempfile::NamedTempFile;

use super::profile::{validate_profile, SftpProfile};

pub fn profiles_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("sftp-profiles.json"))
}

pub fn read_profiles_at(path: &Path) -> Result<Vec<SftpProfile>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let profiles = serde_json::from_slice::<Vec<SftpProfile>>(&bytes).map_err(|e| e.to_string())?;
    for profile in &profiles {
        validate_profile(profile)?;
    }
    Ok(profiles)
}

pub fn write_profiles_at(path: &Path, profiles: &[SftpProfile]) -> Result<(), String> {
    for profile in profiles {
        validate_profile(profile)?;
    }
    let parent = path
        .parent()
        .ok_or_else(|| "profile store path has no parent".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut tmp = NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    serde_json::to_writer_pretty(tmp.as_file_mut(), profiles).map_err(|e| e.to_string())?;
    tmp.as_file_mut()
        .write_all(b"\n")
        .map_err(|e| e.to_string())?;
    tmp.as_file_mut().sync_all().map_err(|e| e.to_string())?;
    tmp.persist(path).map_err(|e| e.error.to_string())?;
    Ok(())
}

pub fn read_profiles(app: &AppHandle) -> Result<Vec<SftpProfile>, String> {
    read_profiles_at(&profiles_path(app)?)
}

pub fn write_profiles(app: &AppHandle, profiles: &[SftpProfile]) -> Result<(), String> {
    write_profiles_at(&profiles_path(app)?, profiles)
}

pub fn upsert_profile(profiles: &mut Vec<SftpProfile>, profile: SftpProfile) -> Result<(), String> {
    validate_profile(&profile)?;
    if let Some(existing) = profiles.iter_mut().find(|item| item.id == profile.id) {
        *existing = profile;
    } else {
        profiles.push(profile);
    }
    profiles.sort_by_key(|profile| profile.name.to_lowercase());
    Ok(())
}

pub fn remove_profile(profiles: &mut Vec<SftpProfile>, profile_id: &str) -> bool {
    let before = profiles.len();
    profiles.retain(|profile| profile.id != profile_id);
    profiles.len() != before
}

pub fn generate_profile_id(username: &str, host: &str) -> String {
    let stem: String = format!("{username}-{host}")
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .chars()
        .take(48)
        .collect();
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    format!("{}-{millis}", if stem.is_empty() { "sftp" } else { &stem })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::sftp::profile::SftpAuthMethod;

    fn profile(id: &str, name: &str) -> SftpProfile {
        SftpProfile {
            id: id.into(),
            name: name.into(),
            host: "example.com".into(),
            port: 22,
            username: "deploy".into(),
            auth_method: SftpAuthMethod::Password,
            private_key_path: None,
            default_remote_path: "/home/deploy".into(),
            trusted_host_key: None,
        }
    }

    #[test]
    fn profile_store_roundtrips_without_secret_fields() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("profiles.json");
        write_profiles_at(&path, &[profile("a", "Alpha")]).unwrap();
        let raw = fs::read_to_string(&path).unwrap();
        assert!(!raw.contains("super-secret"));
        assert!(!raw.contains("passphrase"));
        let loaded = read_profiles_at(&path).unwrap();
        assert_eq!(loaded, vec![profile("a", "Alpha")]);
    }

    #[test]
    fn upsert_replaces_by_id_and_sorts_by_name() {
        let mut profiles = vec![profile("b", "Beta")];
        upsert_profile(&mut profiles, profile("a", "Alpha")).unwrap();
        upsert_profile(&mut profiles, profile("b", "Bravo")).unwrap();
        assert_eq!(
            profiles.iter().map(|p| p.id.as_str()).collect::<Vec<_>>(),
            ["a", "b"]
        );
        assert_eq!(profiles[1].name, "Bravo");
    }
}
