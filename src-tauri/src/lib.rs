pub mod modules;

use modules::{fs, pty, workspace};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
#[cfg(target_os = "macos")]
use tauri::{PhysicalPosition, WindowEvent};
use tauri_plugin_window_state::StateFlags;

/// Drained on first read so HMR / re-mounts can't replay the launch dir.
#[derive(Default)]
struct LaunchDir(Mutex<Option<String>>);

#[tauri::command]
fn get_launch_dir(state: State<'_, LaunchDir>) -> Option<String> {
    state.0.lock().expect("LaunchDir mutex poisoned").take()
}

fn parse_launch_dir() -> Option<String> {
    parse_launch_dir_from_paths(
        std::env::args_os().skip(1).map(PathBuf::from),
        std::env::current_dir().ok().as_deref(),
    )
}

fn parse_launch_dir_from_paths<I>(args: I, cwd: Option<&Path>) -> Option<String>
where
    I: IntoIterator<Item = PathBuf>,
{
    for arg in args {
        if arg.to_string_lossy().starts_with('-') {
            continue;
        }
        let candidate = if arg.is_absolute() {
            arg
        } else if let Some(cwd) = cwd {
            cwd.join(arg)
        } else {
            arg
        };
        let Ok(canon) = std::fs::canonicalize(&candidate) else {
            continue;
        };
        if canon.is_dir() {
            return Some(crate::modules::fs::to_canon(&canon));
        }
    }
    None
}

#[cfg(any(
    test,
    all(
        not(debug_assertions),
        not(any(target_os = "android", target_os = "ios"))
    )
))]
fn resolve_secondary_executable(args: &[String], cwd: &str) -> Option<PathBuf> {
    let path = PathBuf::from(args.first()?);
    Some(if path.is_absolute() {
        path
    } else {
        Path::new(cwd).join(path)
    })
}

#[cfg(any(
    test,
    all(
        not(debug_assertions),
        not(any(target_os = "android", target_os = "ios"))
    )
))]
fn secondary_matches_current_executable(args: &[String], cwd: &str) -> bool {
    let Some(secondary) = resolve_secondary_executable(args, cwd) else {
        return false;
    };
    let Ok(current) = std::env::current_exe() else {
        return false;
    };
    match (
        std::fs::canonicalize(&secondary),
        std::fs::canonicalize(&current),
    ) {
        (Ok(secondary), Ok(current)) => secondary == current,
        _ => secondary == current,
    }
}

fn log_launch_context(app: &tauri::AppHandle) {
    let exe = std::env::current_exe()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|error| format!("<unavailable: {error}>"));
    let cwd = std::env::current_dir()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|error| format!("<unavailable: {error}>"));
    let args = std::env::args_os()
        .map(|arg| arg.to_string_lossy().into_owned())
        .collect::<Vec<_>>();

    #[cfg(target_os = "windows")]
    let parent = modules::proc::parent_process()
        .map(|(pid, name)| format!("{name} ({pid})"))
        .unwrap_or_else(|| "<unavailable>".to_string());
    #[cfg(not(target_os = "windows"))]
    let parent = "<not-recorded>";

    log::info!(
        "process started pid={} profile={} identifier={:?} exe={exe:?} cwd={cwd:?} parent={parent} args={args:?}",
        std::process::id(),
        if cfg!(debug_assertions) {
            "debug"
        } else {
            "release"
        },
        app.config().identifier,
    );
}

#[tauri::command]
async fn open_settings_window(app: tauri::AppHandle, tab: Option<String>) -> Result<(), String> {
    let url_path = match tab.as_deref() {
        Some(t) if !t.is_empty() => format!("settings.html?tab={}", t),
        _ => "settings.html".to_string(),
    };

    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.set_always_on_top(true);
        let _ = window.show();
        let _ = window.set_focus();
        if let Some(t) = tab.as_deref().filter(|s| !s.is_empty()) {
            // emit() serializes via JSON — no string-escape footgun, unlike
            // eval() with format!(). Frontend listens via Tauri event API.
            let _ = window.emit("kite:settings-tab", t);
        }
        return Ok(());
    }

    let builder = WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App(url_path.into()))
        .title("Settings")
        .inner_size(900.0, 700.0)
        .min_inner_size(820.0, 620.0)
        .resizable(true)
        .visible(false)
        // Keep settings above the main app window so it doesn't get hidden
        // when the user clicks back into the editor or terminal (#33).
        .always_on_top(true);

    // Tie lifecycle to the main window so settings minimizes/closes with it.
    // macOS: skip parent() — child + always_on_top leaves the settings webview
    // behind the main window except while the parent is being dragged (#33).
    #[cfg(not(target_os = "macos"))]
    let builder = if let Some(main) = app.get_webview_window("main") {
        builder.parent(&main).map_err(|e| e.to_string())?
    } else {
        builder
    };

    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);

    // On Linux/Windows we render our own titlebar, so drop native chrome
    // and make the window transparent.
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let builder = builder.decorations(false).transparent(true);

    let window = builder.build().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    let _ = &window;

    // Some Linux compositors (GNOME/Mutter with CSD-by-default) ignore the
    // builder-time decorations flag — re-assert it after realize.
    #[cfg(target_os = "linux")]
    {
        let _ = window.set_decorations(false);
    }

    #[cfg(target_os = "macos")]
    if let Some(main) = app.get_webview_window("main") {
        if let (Ok(main_pos), Ok(main_size), Ok(settings_size)) = (
            main.outer_position(),
            main.outer_size(),
            window.outer_size(),
        ) {
            let x = main_pos.x
                + ((main_size.width as i32).saturating_sub(settings_size.width as i32)) / 2;
            let y = main_pos.y
                + ((main_size.height as i32).saturating_sub(settings_size.height as i32)) / 2;
            let _ = window.set_position(PhysicalPosition::new(x, y));
        } else {
            let _ = window.center();
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cli_dir = parse_launch_dir();
    workspace::init_launch_cwd(cli_dir.as_deref());

    let builder = tauri::Builder::default();
    #[cfg(all(
        not(debug_assertions),
        not(any(target_os = "android", target_os = "ios"))
    ))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
        if !secondary_matches_current_executable(&args, &cwd) {
            log::warn!("ignored second instance cwd={cwd:?} args={args:?}");
            return;
        }
        log::info!("accepted second instance cwd={cwd:?} args={args:?}");
        let launch_dir = parse_launch_dir_from_paths(
            args.iter().skip(1).map(|arg| PathBuf::from(arg.as_str())),
            Some(Path::new(&cwd)),
        );
        if let Some(ref dir) = launch_dir {
            let registry = app.state::<workspace::WorkspaceRegistry>();
            let _ = registry.authorize(dir);
            let _ = app.emit("kite:open-launch-dir", dir);
        }
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }));
    #[cfg(target_os = "linux")]
    let builder = builder.plugin(tauri_plugin_clipboard_manager::init());
    builder
        // Skip restoring VISIBLE/MAXIMIZED/FULLSCREEN — frontend calls
        // window.show() after first paint so the user never sees a
        // transparent window-shadow flash on Windows/Linux. MAXIMIZED and
        // FULLSCREEN are also excluded because set_maximized(true) maps to
        // ShowWindow(SW_MAXIMIZE) which forces the window visible even when
        // it was created hidden.
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(tauri_plugin_log::log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            log_launch_context(_app.handle());
            // macOS skips parent() for the settings window, so tie its lifecycle
            // to the main window here instead. Other platforms keep parent().
            #[cfg(target_os = "macos")]
            if let Some(main) = _app.get_webview_window("main") {
                let handle = _app.handle().clone();
                main.on_window_event(move |event| {
                    if matches!(
                        event,
                        WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed
                    ) {
                        if let Some(settings) = handle.get_webview_window("settings") {
                            let _ = settings.close();
                        }
                    }
                });
            }
            Ok(())
        })
        .manage(pty::PtyState::default())
        .manage({
            let registry = workspace::WorkspaceRegistry::default();
            workspace::bootstrap_registry(&registry);
            if let Some(ref launch_dir) = cli_dir {
                let _ = registry.authorize(launch_dir);
            }
            registry
        })
        .manage(LaunchDir(Mutex::new(cli_dir)))
        .invoke_handler(tauri::generate_handler![
            pty::pty_open,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_close,
            pty::pty_close_all,
            pty::pty_has_foreground_process,
            pty::pty_has_foreground_job,
            pty::pty_list_shells,
            fs::tree::list_subdirs,
            fs::tree::fs_read_dir,
            workspace::wsl_list_distros,
            workspace::wsl_home,
            workspace::workspace_authorize,
            workspace::workspace_current_dir,
            get_launch_dir,
            open_settings_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{
        parse_launch_dir_from_paths, resolve_secondary_executable,
        secondary_matches_current_executable,
    };
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn tempdir(label: &str) -> PathBuf {
        let mut dir = std::env::temp_dir();
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        dir.push(format!(
            "kite-launch-{label}-{nanos}-{}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).expect("create temp launch dir");
        fs::canonicalize(dir).expect("canonicalize temp launch dir")
    }

    #[test]
    fn resolves_secondary_executable_against_reported_cwd() {
        let args = vec!["target/debug/kite".to_string()];
        assert_eq!(
            resolve_secondary_executable(&args, "workspace"),
            Some(PathBuf::from("workspace").join("target/debug/kite"))
        );
    }

    #[test]
    fn accepts_the_current_executable() {
        let current = std::env::current_exe().expect("test executable path");
        let args = vec![current.display().to_string()];
        assert!(secondary_matches_current_executable(&args, "ignored"));
    }

    #[test]
    fn rejects_missing_secondary_executable() {
        assert!(!secondary_matches_current_executable(&[], "workspace"));
    }

    #[test]
    fn rejects_a_different_executable_path() {
        let current = std::env::current_exe().expect("test executable path");
        let args = vec![current
            .parent()
            .expect("test executable parent")
            .display()
            .to_string()];
        assert!(!secondary_matches_current_executable(&args, "ignored"));
    }

    #[test]
    fn parses_first_usable_launch_directory() {
        let dir = tempdir("direct");
        let file = dir.join("note.txt");
        fs::write(&file, "not a directory").expect("write file");

        let parsed =
            parse_launch_dir_from_paths([PathBuf::from("--flag"), file, dir.clone()], None);

        assert_eq!(parsed, Some(crate::modules::fs::to_canon(&dir)));
    }

    #[test]
    fn resolves_relative_launch_directory_against_cwd() {
        let cwd = tempdir("cwd");
        let project = cwd.join("project");
        fs::create_dir_all(&project).expect("create project");

        let parsed = parse_launch_dir_from_paths([PathBuf::from("project")], Some(&cwd));

        assert_eq!(parsed, Some(crate::modules::fs::to_canon(&project)));
    }
}
