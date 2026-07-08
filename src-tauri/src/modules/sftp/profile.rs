use serde::{Deserialize, Serialize};

const SECRET_KEY_PREFIX: &str = "kite-sftp";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SftpAuthMethod {
    Password,
    PrivateKey,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpProfile {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u32,
    pub username: String,
    pub auth_method: SftpAuthMethod,
    pub private_key_path: Option<String>,
    pub default_remote_path: String,
    pub trusted_host_key: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SftpSecretKind {
    Password,
    Passphrase,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HostKeyTrust {
    Missing,
    Trusted,
    Mismatch,
}

pub fn validate_profile(profile: &SftpProfile) -> Result<(), String> {
    require_text("id", &profile.id)?;
    require_text("name", &profile.name)?;
    require_text("host", &profile.host)?;
    require_text("username", &profile.username)?;
    require_text("remote path", &profile.default_remote_path)?;

    if profile.port == 0 || profile.port > 65_535 {
        return Err("port must be between 1 and 65535".into());
    }
    if !profile.default_remote_path.starts_with('/') {
        return Err("remote path must be absolute".into());
    }
    if let Some(path) = &profile.private_key_path {
        reject_nul("private key path", path)?;
    }
    if matches!(profile.auth_method, SftpAuthMethod::PrivateKey)
        && profile
            .private_key_path
            .as_deref()
            .map(str::trim)
            .filter(|path| !path.is_empty())
            .is_none()
    {
        return Err("private key path is required".into());
    }
    if let Some(host_key) = &profile.trusted_host_key {
        reject_nul("trusted host key", host_key)?;
    }
    Ok(())
}

pub fn secret_key(profile_id: &str, kind: SftpSecretKind) -> String {
    let suffix = match kind {
        SftpSecretKind::Password => "password",
        SftpSecretKind::Passphrase => "passphrase",
    };
    format!("{SECRET_KEY_PREFIX}:{}:{suffix}", profile_id.trim())
}

pub fn compare_host_key(stored: Option<&str>, presented: &str) -> HostKeyTrust {
    let Some(stored) = stored.map(str::trim).filter(|value| !value.is_empty()) else {
        return HostKeyTrust::Missing;
    };
    if stored == presented.trim() {
        HostKeyTrust::Trusted
    } else {
        HostKeyTrust::Mismatch
    }
}

fn require_text(field: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("{field} is required"));
    }
    reject_nul(field, value)
}

fn reject_nul(field: &str, value: &str) -> Result<(), String> {
    if value.contains('\0') {
        Err(format!("{field} cannot contain NUL bytes"))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_profile() -> SftpProfile {
        SftpProfile {
            id: "prod-1".into(),
            name: "Production".into(),
            host: "example.com".into(),
            port: 22,
            username: "deploy".into(),
            auth_method: SftpAuthMethod::Password,
            private_key_path: None,
            default_remote_path: "/home/deploy".into(),
            trusted_host_key: Some("SHA256:abc".into()),
        }
    }

    #[test]
    fn profile_validation_accepts_minimum_valid_profile() {
        validate_profile(&valid_profile()).expect("valid profile");
    }

    #[test]
    fn profile_validation_rejects_required_blank_fields() {
        type ProfileUpdate = fn(&mut SftpProfile);
        let cases: [(&str, ProfileUpdate); 4] = [
            ("id", |profile: &mut SftpProfile| profile.id = "  ".into()),
            ("name", |profile: &mut SftpProfile| {
                profile.name = "\t".into()
            }),
            ("host", |profile: &mut SftpProfile| profile.host = "".into()),
            ("username", |profile: &mut SftpProfile| {
                profile.username = "  ".into()
            }),
        ];
        for (field, update) in cases {
            let mut profile = valid_profile();
            update(&mut profile);
            let err = validate_profile(&profile).expect_err("blank field must fail");
            assert!(err.contains(field), "expected {field} in error, got: {err}");
        }
    }

    #[test]
    fn profile_validation_rejects_invalid_ports() {
        for port in [0, 65_536] {
            let mut profile = valid_profile();
            profile.port = port;
            let err = validate_profile(&profile).expect_err("invalid port must fail");
            assert!(err.contains("port"), "got: {err}");
        }
    }

    #[test]
    fn profile_validation_requires_absolute_remote_path() {
        for path in ["", "relative/path", "C:/Users/Admin"] {
            let mut profile = valid_profile();
            profile.default_remote_path = path.into();
            let err = validate_profile(&profile).expect_err("relative path must fail");
            assert!(err.contains("remote path"), "got: {err}");
        }
    }

    #[test]
    fn profile_validation_rejects_nul_bytes() {
        let mut profile = valid_profile();
        profile.host = "example.com\0evil".into();
        let err = validate_profile(&profile).expect_err("nul byte must fail");
        assert!(err.contains("host"), "got: {err}");
    }

    #[test]
    fn profile_validation_requires_private_key_path_for_key_auth() {
        let mut profile = valid_profile();
        profile.auth_method = SftpAuthMethod::PrivateKey;
        let err = validate_profile(&profile).expect_err("key auth requires path");
        assert!(err.contains("private key path"), "got: {err}");

        profile.private_key_path = Some("C:/Users/me/.ssh/id_ed25519".into());
        validate_profile(&profile).expect("key profile with path");
    }

    #[test]
    fn secret_keys_follow_the_documented_namespace() {
        assert_eq!(
            secret_key("prod-1", SftpSecretKind::Password),
            "kite-sftp:prod-1:password"
        );
        assert_eq!(
            secret_key("prod-1", SftpSecretKind::Passphrase),
            "kite-sftp:prod-1:passphrase"
        );
    }

    #[test]
    fn host_key_trust_distinguishes_missing_match_and_mismatch() {
        assert_eq!(compare_host_key(None, "SHA256:new"), HostKeyTrust::Missing);
        assert_eq!(
            compare_host_key(Some(" SHA256:abc "), "SHA256:abc"),
            HostKeyTrust::Trusted
        );
        assert_eq!(
            compare_host_key(Some("SHA256:abc"), "SHA256:def"),
            HostKeyTrust::Mismatch
        );
    }
}
