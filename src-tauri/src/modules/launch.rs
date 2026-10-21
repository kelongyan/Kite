use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

// Snapshotted once at app startup from an explicit launch directory only
// (Windows "Open in Kite", or a CLI dir arg). A plain app launch intentionally
// falls back to the user home, not the process current_dir.
static LAUNCH_CWD: OnceLock<Option<PathBuf>> = OnceLock::new();

pub(crate) fn init_launch_cwd(cli_dir: Option<&str>) {
    LAUNCH_CWD.get_or_init(|| resolve_launch_cwd(cli_dir));
}

fn resolve_launch_cwd(cli_dir: Option<&str>) -> Option<PathBuf> {
    if let Some(dir) = cli_dir {
        let p = PathBuf::from(dir);
        if is_usable_launch_dir(&p) {
            return Some(p);
        }
    }
    None
}

pub(crate) fn launch_cwd_snapshot() -> Option<PathBuf> {
    LAUNCH_CWD.get().and_then(|o| o.clone())
}

// A requested cwd can be stale or missing; the terminal must still open, so
// fall back to the launch snapshot or home.
pub(crate) fn spawn_cwd_or_home(cwd: Option<&str>) -> Option<String> {
    let cwd = cwd.map(str::trim).filter(|s| !s.is_empty())?;
    match std::fs::canonicalize(cwd) {
        Ok(canonical) if canonical.is_dir() => Some(cwd.to_owned()),
        Ok(_) => {
            log::warn!("pty cwd {cwd:?} is not a directory; opening home");
            None
        }
        Err(e) => {
            log::warn!("pty cwd {cwd:?} unusable ({e}); opening home");
            None
        }
    }
}

fn is_usable_launch_dir(path: &Path) -> bool {
    if !path.is_dir() || path == Path::new("/") {
        return false;
    }
    if is_executable_dir(path) {
        return false;
    }
    let s = path.to_string_lossy();
    if s.contains(".app/Contents/") {
        return false;
    }
    // The AppImage mount (/tmp/.mount_*) is not a real working directory.
    #[cfg(target_os = "linux")]
    if std::env::var_os("APPDIR").is_some_and(|appdir| path.starts_with(&appdir)) {
        return false;
    }
    if cfg!(debug_assertions) && path.file_name().and_then(|s| s.to_str()) == Some("src-tauri") {
        return false;
    }
    true
}

fn is_executable_dir(path: &Path) -> bool {
    let Ok(exe) = std::env::current_exe() else {
        return false;
    };
    let Some(exe_dir) = exe.parent() else {
        return false;
    };
    match (std::fs::canonicalize(path), std::fs::canonicalize(exe_dir)) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    }
}

#[cfg(target_os = "linux")]
const APPIMAGE_PATH_VARS: &[&str] = &[
    "LD_LIBRARY_PATH",
    "PATH",
    "XDG_DATA_DIRS",
    "GST_PLUGIN_SYSTEM_PATH",
    "GST_PLUGIN_SYSTEM_PATH_1_0",
    "GST_PLUGIN_PATH",
    "GI_TYPELIB_PATH",
    "GDK_PIXBUF_MODULEDIR",
    "GIO_MODULE_DIR",
    "GSETTINGS_SCHEMA_DIR",
];

#[cfg(target_os = "linux")]
const APPIMAGE_VALUE_VARS: &[&str] = &[
    "GDK_PIXBUF_MODULE_FILE",
    "LD_PRELOAD",
    "FONTCONFIG_FILE",
    "FONTCONFIG_PATH",
];

#[cfg(target_os = "linux")]
const APPIMAGE_MARKER_VARS: &[&str] = &["APPDIR", "APPIMAGE", "ARGV0"];

pub(crate) fn appimage_env_overrides() -> Vec<(&'static str, Option<OsString>)> {
    #[cfg(target_os = "linux")]
    {
        let Some(appdir) = std::env::var_os("APPDIR") else {
            return Vec::new();
        };
        compute_appimage_env_overrides(Path::new(&appdir), |k| std::env::var_os(k))
    }
    #[cfg(not(target_os = "linux"))]
    {
        Vec::new()
    }
}

#[cfg(target_os = "linux")]
fn compute_appimage_env_overrides(
    appdir: &Path,
    read: impl Fn(&str) -> Option<OsString>,
) -> Vec<(&'static str, Option<OsString>)> {
    let mut out = Vec::new();

    for &key in APPIMAGE_PATH_VARS {
        let Some(val) = read(key) else { continue };
        let original: Vec<PathBuf> = std::env::split_paths(&val).collect();
        let kept: Vec<PathBuf> = original
            .iter()
            .filter(|p| !p.as_os_str().is_empty() && !p.starts_with(appdir))
            .cloned()
            .collect();
        if kept.len() == original.len() {
            continue; // nothing AppImage-injected; leave as-is
        }
        match std::env::join_paths(&kept) {
            Ok(joined) if !kept.is_empty() => out.push((key, Some(joined))),
            _ => out.push((key, None)),
        }
    }

    for &key in APPIMAGE_VALUE_VARS {
        if read(key).is_some_and(|v| Path::new(&v).starts_with(appdir)) {
            out.push((key, None));
        }
    }

    for &key in APPIMAGE_MARKER_VARS {
        if read(key).is_some() {
            out.push((key, None));
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;

    fn tempdir(label: &str) -> PathBuf {
        let mut p = env::temp_dir();
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        p.push(format!(
            "kite-launch-{label}-{nanos}-{}",
            std::process::id()
        ));
        fs::create_dir_all(&p).expect("create tempdir");
        fs::canonicalize(&p).expect("canonicalize tempdir")
    }

    #[test]
    fn spawn_cwd_keeps_accessible_dir() {
        let dir = tempdir("spawn-ok");
        let s = dir.to_string_lossy().into_owned();
        assert_eq!(spawn_cwd_or_home(Some(&s)), Some(s));
    }

    #[test]
    fn spawn_cwd_falls_back_when_inaccessible() {
        let mut missing = env::temp_dir();
        missing.push(format!("kite-spawn-missing-{}", std::process::id()));
        let s = missing.to_string_lossy().into_owned();
        assert_eq!(spawn_cwd_or_home(Some(&s)), None);
    }

    #[test]
    fn spawn_cwd_passes_through_empty() {
        assert_eq!(spawn_cwd_or_home(None), None);
        assert_eq!(spawn_cwd_or_home(Some("  ")), None);
    }

    #[test]
    fn resolve_launch_cwd_uses_cli_dir() {
        let cli = tempdir("cli");
        let s = cli.to_string_lossy().into_owned();
        let resolved = resolve_launch_cwd(Some(&s));
        assert_eq!(resolved.as_deref(), Some(cli.as_path()));
    }

    #[test]
    fn resolve_launch_cwd_is_empty_when_cli_missing() {
        assert_eq!(resolve_launch_cwd(None), None);
    }

    #[test]
    fn resolve_launch_cwd_ignores_nonexistent_cli_dir() {
        let resolved = resolve_launch_cwd(Some("/no/such/kite/dir"));
        assert_eq!(resolved, None);
    }
}

#[cfg(all(test, target_os = "linux"))]
mod appimage_tests {
    use super::*;
    use std::collections::HashMap;

    fn reader(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Option<OsString> {
        let map: HashMap<String, OsString> = pairs
            .iter()
            .map(|(k, v)| (k.to_string(), OsString::from(v)))
            .collect();
        move |k: &str| map.get(k).cloned()
    }

    fn find<'a>(
        out: &'a [(&'static str, Option<OsString>)],
        key: &str,
    ) -> Option<&'a Option<OsString>> {
        out.iter().find(|(k, _)| *k == key).map(|(_, v)| v)
    }

    #[test]
    fn strips_appdir_from_path_lists_and_unsets_when_empty() {
        let appdir = Path::new("/tmp/.mount_Kite_X");
        let env = reader(&[
            ("LD_LIBRARY_PATH", "/tmp/.mount_Kite_X/usr/lib:/usr/lib"),
            ("PATH", "/tmp/.mount_Kite_X/usr/bin:/usr/bin:/bin"),
            (
                "GST_PLUGIN_SYSTEM_PATH",
                "/tmp/.mount_Kite_X/usr/lib/gstreamer-1.0",
            ),
            ("APPDIR", "/tmp/.mount_Kite_X"),
        ]);
        let out = compute_appimage_env_overrides(appdir, env);

        assert_eq!(
            find(&out, "LD_LIBRARY_PATH"),
            Some(&Some(OsString::from("/usr/lib")))
        );
        assert_eq!(
            find(&out, "PATH"),
            Some(&Some(OsString::from("/usr/bin:/bin")))
        );
        // Only an APPDIR entry, so the var is removed entirely.
        assert_eq!(find(&out, "GST_PLUGIN_SYSTEM_PATH"), Some(&None));
        assert_eq!(find(&out, "APPDIR"), Some(&None));
    }

    #[test]
    fn leaves_untouched_vars_alone() {
        let appdir = Path::new("/tmp/.mount_Kite_X");
        let env = reader(&[
            ("LD_LIBRARY_PATH", "/usr/lib:/usr/local/lib"),
            ("LD_PRELOAD", "/home/u/my.so"),
        ]);
        let out = compute_appimage_env_overrides(appdir, env);

        // No APPDIR component => no override emitted for these.
        assert!(find(&out, "LD_LIBRARY_PATH").is_none());
        assert!(find(&out, "LD_PRELOAD").is_none());
    }

    #[test]
    fn unsets_value_vars_only_when_pointing_into_appdir() {
        let appdir = Path::new("/tmp/.mount_Kite_X");
        let into = reader(&[("LD_PRELOAD", "/tmp/.mount_Kite_X/usr/lib/x.so")]);
        assert_eq!(
            find(&compute_appimage_env_overrides(appdir, into), "LD_PRELOAD"),
            Some(&None)
        );

        let outside = reader(&[("FONTCONFIG_FILE", "/etc/fonts/fonts.conf")]);
        assert!(find(
            &compute_appimage_env_overrides(appdir, outside),
            "FONTCONFIG_FILE"
        )
        .is_none());
    }
}
