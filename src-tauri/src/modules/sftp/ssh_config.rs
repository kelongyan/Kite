use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use super::profile::SftpAuthMethod;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpSshConfigTemplate {
    pub name: String,
    pub host: String,
    pub port: u32,
    pub username: String,
    pub auth_method: SftpAuthMethod,
    pub private_key_path: Option<String>,
    pub default_remote_path: String,
}

#[derive(Default)]
struct HostBlock {
    aliases: Vec<String>,
    host_name: Option<String>,
    user: Option<String>,
    port: Option<u32>,
    identity_file: Option<String>,
}

#[tauri::command]
pub fn sftp_ssh_config_templates() -> Result<Vec<SftpSshConfigTemplate>, String> {
    let Some(home) = dirs::home_dir() else {
        return Ok(Vec::new());
    };
    let path = home.join(".ssh").join("config");
    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(err) => return Err(err.to_string()),
    };
    parse_ssh_config_templates(&content, &home)
}

pub fn parse_ssh_config_templates(
    content: &str,
    home: &Path,
) -> Result<Vec<SftpSshConfigTemplate>, String> {
    let mut templates = Vec::new();
    let mut current: Option<HostBlock> = None;

    for (line_no, raw_line) in content.lines().enumerate() {
        let tokens = tokenize_config_line(raw_line)
            .map_err(|err| format!("SSH config line {}: {err}", line_no + 1))?;
        if tokens.is_empty() {
            continue;
        }

        let keyword = tokens[0].to_ascii_lowercase();
        let values = &tokens[1..];
        if keyword == "host" {
            flush_block(current.take(), &mut templates);
            current = Some(HostBlock {
                aliases: host_aliases(values),
                ..HostBlock::default()
            });
            continue;
        }

        let Some(block) = current.as_mut() else {
            continue;
        };
        let Some(value) = values.first() else {
            continue;
        };
        match keyword.as_str() {
            "hostname" if is_safe_host(value) => block.host_name = Some(value.clone()),
            "user" if is_safe_user(value) => block.user = Some(value.clone()),
            "port" => {
                if let Ok(port) = value.parse::<u32>() {
                    if (1..=65_535).contains(&port) {
                        block.port = Some(port);
                    }
                }
            }
            "identityfile" if block.identity_file.is_none() => {
                block.identity_file = normalize_identity_file(value, home);
            }
            _ => {}
        }
    }

    flush_block(current.take(), &mut templates);
    templates.sort_by_key(|template| template.name.to_lowercase());
    Ok(templates)
}

fn flush_block(block: Option<HostBlock>, templates: &mut Vec<SftpSshConfigTemplate>) {
    let Some(block) = block else {
        return;
    };
    for alias in block.aliases {
        let host = block.host_name.clone().unwrap_or_else(|| alias.clone());
        if !is_safe_host(&host) {
            continue;
        }
        let username = block.user.clone().unwrap_or_default();
        let auth_method = if block.identity_file.is_some() {
            SftpAuthMethod::PrivateKey
        } else {
            SftpAuthMethod::Password
        };
        templates.push(SftpSshConfigTemplate {
            name: alias,
            host,
            port: block.port.unwrap_or(22),
            username: username.clone(),
            auth_method,
            private_key_path: block.identity_file.clone(),
            default_remote_path: default_remote_path(&username),
        });
    }
}

fn host_aliases(values: &[String]) -> Vec<String> {
    if values.iter().any(|value| {
        value.starts_with('!') || value.contains('*') || value.contains('?') || value.contains('\0')
    }) {
        return Vec::new();
    }
    values
        .iter()
        .filter(|value| is_safe_host(value))
        .cloned()
        .collect()
}

fn normalize_identity_file(value: &str, home: &Path) -> Option<String> {
    if value.is_empty()
        || value.contains('\0')
        || value.contains('%')
        || value.contains('*')
        || value.contains('?')
    {
        return None;
    }
    let path = if let Some(rest) = value
        .strip_prefix("~/")
        .or_else(|| value.strip_prefix("~\\"))
    {
        home.join(rest)
    } else if value.starts_with('~') {
        return None;
    } else {
        let path = PathBuf::from(value);
        if !path.is_absolute() {
            return None;
        }
        path
    };
    Some(path_to_frontend_string(path))
}

fn tokenize_config_line(line: &str) -> Result<Vec<String>, String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;
    let mut escaped = false;

    for ch in line.chars() {
        if escaped {
            current.push(ch);
            escaped = false;
            continue;
        }
        if ch == '\\' {
            escaped = true;
            continue;
        }
        if let Some(q) = quote {
            if ch == q {
                quote = None;
            } else {
                current.push(ch);
            }
            continue;
        }
        if ch == '#' {
            break;
        }
        if ch == '"' || ch == '\'' {
            quote = Some(ch);
            continue;
        }
        if ch.is_whitespace() {
            if !current.is_empty() {
                tokens.push(current.clone());
                current.clear();
            }
            continue;
        }
        current.push(ch);
    }

    if escaped {
        current.push('\\');
    }
    if quote.is_some() {
        return Err("unterminated quote".into());
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    Ok(split_keyword_equals(tokens))
}

fn split_keyword_equals(tokens: Vec<String>) -> Vec<String> {
    let Some((first, rest)) = tokens.split_first() else {
        return tokens;
    };
    let Some((key, value)) = first.split_once('=') else {
        return tokens;
    };
    let mut out = vec![key.to_string()];
    if !value.is_empty() {
        out.push(value.to_string());
    }
    out.extend(rest.iter().cloned());
    out
}

fn is_safe_host(value: &str) -> bool {
    !value.trim().is_empty()
        && !value.contains('\0')
        && !value.contains('/')
        && !value.contains('\\')
        && !value.chars().any(char::is_whitespace)
        && !value.contains('%')
}

fn is_safe_user(value: &str) -> bool {
    !value.trim().is_empty()
        && !value.contains('\0')
        && !value.contains('/')
        && !value.contains('\\')
        && !value.contains('%')
        && !value.chars().any(char::is_whitespace)
}

fn default_remote_path(username: &str) -> String {
    if username == "root" {
        "/root".into()
    } else if username.is_empty() {
        "/home".into()
    } else {
        format!("/home/{username}")
    }
}

fn path_to_frontend_string(path: PathBuf) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::super::profile::SftpAuthMethod;
    use super::*;

    #[test]
    fn parses_host_entries_with_identity_file() {
        let home = std::path::Path::new("/home/me");
        let config = r#"
Host prod
  HostName prod.example.com
  User deploy
  Port 2222
  IdentityFile ~/.ssh/prod_ed25519
"#;

        let templates = parse_ssh_config_templates(config, home).unwrap();

        assert_eq!(templates.len(), 1);
        assert_eq!(templates[0].name, "prod");
        assert_eq!(templates[0].host, "prod.example.com");
        assert_eq!(templates[0].port, 2222);
        assert_eq!(templates[0].username, "deploy");
        assert_eq!(templates[0].auth_method, SftpAuthMethod::PrivateKey);
        assert_eq!(
            templates[0].private_key_path.as_deref(),
            Some("/home/me/.ssh/prod_ed25519")
        );
        assert_eq!(templates[0].default_remote_path, "/home/deploy");
    }

    #[test]
    fn skips_wildcard_hosts_and_unsafe_identity_tokens() {
        let home = std::path::Path::new("/home/me");
        let config = r#"
Host *
  User shared
Host app? prod
  HostName should-not-appear.example.com
Host safe
  HostName safe.example.com
  User ops
  IdentityFile ~/.ssh/%h
"#;

        let templates = parse_ssh_config_templates(config, home).unwrap();

        assert_eq!(templates.len(), 1);
        assert_eq!(templates[0].name, "safe");
        assert_eq!(templates[0].host, "safe.example.com");
        assert_eq!(templates[0].private_key_path, None);
    }
}
