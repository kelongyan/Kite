//! Update check: query the GitHub Releases API for the latest tag and compare
//! against the running version. Runs on the backend because the webview CSP
//! deliberately blocks outbound network (connect-src is localhost only).

use serde::Serialize;

const RELEASES_API: &str = "https://api.github.com/repos/kelongyan/Kite/releases/latest";
const RELEASES_PAGE: &str = "https://github.com/kelongyan/Kite/releases/latest";
const TIMEOUT_SECS: u64 = 10;

#[derive(Serialize)]
pub struct UpdateCheck {
    /// Latest release tag (e.g. "v2.1.0"), null when up to date.
    pub latest: Option<String>,
    pub releases_page: &'static str,
}

/// Compare dot-separated numeric versions. A pre-release suffix ("0-beta.1")
/// sorts below the same bare number (semver rule 9). Returns true when
/// `remote` is strictly newer.
fn is_newer_version(remote: &str, local: &str) -> bool {
    fn parse(v: &str) -> Vec<(u64, Option<String>)> {
        v.trim()
            .trim_start_matches(['v', 'V'])
            .split('.')
            .map(|part| {
                let digits_len = part.chars().take_while(|c| c.is_ascii_digit()).count();
                let numeric = part[..digits_len].parse::<u64>().unwrap_or(0);
                let suffix = &part[digits_len..];
                let pre = (!suffix.is_empty()).then(|| suffix.to_string());
                (numeric, pre)
            })
            .collect()
    }
    let (a, b) = (parse(remote), parse(local));
    for i in 0..a.len().max(b.len()) {
        let (na, sa) = a.get(i).cloned().unwrap_or((0, None));
        let (nb, sb) = b.get(i).cloned().unwrap_or((0, None));
        if na != nb {
            return na > nb;
        }
        match (&sa, &sb) {
            // 2.0.0 > 2.0.0-beta; equal pre-releases keep scanning.
            (None, Some(_)) => return true,
            (Some(_), None) => return false,
            _ => {}
        }
    }
    false
}

#[tauri::command]
pub async fn check_for_update() -> Result<UpdateCheck, String> {
    tauri::async_runtime::spawn_blocking(|| {
        // Honor HTTP(S)_PROXY/ALL_PROXY when set: ureq ignores proxy env
        // vars unless told explicitly, and direct github.com access is
        // blocked on some networks.
        let agent: ureq::Agent = ureq::Agent::config_builder()
            .timeout_global(Some(std::time::Duration::from_secs(TIMEOUT_SECS)))
            .proxy(ureq::Proxy::try_from_env())
            .build()
            .into();
        let mut response = agent
            .get(RELEASES_API)
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "Kite-Terminal-Update-Check")
            .call()
            .map_err(|e| {
                if matches!(
                    e,
                    ureq::Error::StatusCode(404) | ureq::Error::StatusCode(403)
                ) {
                    "GitHub API unavailable (rate limited or no releases yet)".to_string()
                } else {
                    format!("network error: {e}")
                }
            })?;
        let body = response
            .body_mut()
            .read_to_string()
            .map_err(|e| format!("read error: {e}"))?;
        let tag = serde_json::from_str::<serde_json::Value>(&body)
            .map_err(|e| format!("unexpected GitHub API response: {e}"))
            .and_then(|v| {
                v.get("tag_name")
                    .and_then(|t| t.as_str())
                    .map(String::from)
                    .ok_or_else(|| {
                        let snippet: String = body.chars().take(120).collect();
                        format!("GitHub API response without tag_name: {snippet}")
                    })
            })?;
        let local = env!("CARGO_PKG_VERSION");
        Ok(UpdateCheck {
            latest: if is_newer_version(&tag, local) {
                Some(tag)
            } else {
                None
            },
            releases_page: RELEASES_PAGE,
        })
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::is_newer_version;

    #[test]
    fn compares_semver_segments() {
        assert!(is_newer_version("2.1.0", "2.0.0"));
        assert!(is_newer_version("v2.1.0", "2.0.0"));
        assert!(is_newer_version("2.0.10", "2.0.9"));
        assert!(!is_newer_version("2.0.0", "2.0.0"));
        assert!(!is_newer_version("1.9.9", "2.0.0"));
        assert!(is_newer_version("3.0", "2.9.9"));
        // Suffix ordering: pre-releases sort below the bare version.
        assert!(is_newer_version("2.0.0", "2.0.0-beta.1"));
        assert!(!is_newer_version("2.0.0-beta.1", "2.0.0"));
    }
}
