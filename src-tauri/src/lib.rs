pub mod modules;

use modules::{fs, pty, workspace};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
#[cfg(target_os = "macos")]
use tauri::WindowEvent;
use tauri::{Emitter, Manager, PhysicalPosition, State, WebviewUrl, WebviewWindowBuilder};
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

/// Initial inner size for the settings dialog, in logical pixels.
///
/// Kite's default main window is 800x600, smaller than the 900x700 the settings
/// UI is designed for. Without shrinking to fit, the dialog covers the window it
/// belongs to (header controls included), so it reads as the main window rather
/// than as a dialog on top of it.
fn settings_inner_size(main_inner: Option<(u32, u32)>) -> (u32, u32) {
    const DESIGN: (u32, u32) = (900, 700);
    const FLOOR: (u32, u32) = (680, 520);
    // Leaves a visible frame of the main window around the dialog.
    const MARGIN: u32 = 80;
    let Some((width, height)) = main_inner else {
        return DESIGN;
    };
    (
        DESIGN.0.min(width.saturating_sub(MARGIN)).max(FLOOR.0),
        DESIGN.1.min(height.saturating_sub(MARGIN)).max(FLOOR.1),
    )
}

/// Center a `win_size` window over an anchor window, clamped to `work_area`.
///
/// The clamp matters because the settings window is larger than a small main
/// window: plain centering would push it off the left or top edge of the screen.
fn centered_position(
    anchor_pos: (i32, i32),
    anchor_size: (u32, u32),
    win_size: (u32, u32),
    work_area: Option<((i32, i32), (u32, u32))>,
) -> (i32, i32) {
    let mut x = anchor_pos.0 + (anchor_size.0 as i32 - win_size.0 as i32) / 2;
    let mut y = anchor_pos.1 + (anchor_size.1 as i32 - win_size.1 as i32) / 2;
    if let Some(((area_x, area_y), (area_w, area_h))) = work_area {
        // min() before max() so a window taller or wider than the work area pins
        // to its origin instead of hanging off the opposite edge.
        x = x
            .min(area_x + area_w as i32 - win_size.0 as i32)
            .max(area_x);
        y = y
            .min(area_y + area_h as i32 - win_size.1 as i32)
            .max(area_y);
    }
    (x, y)
}

/// Place `window` centered over the main window.
///
/// The settings window is a dialog, so it opens centered every time instead of
/// wherever it was last dragged. A remembered position could align it exactly
/// with the main window, which then looks like one window while every click near
/// the main window's header lands on the settings window instead.
fn center_over_main(app: &tauri::AppHandle, window: &tauri::WebviewWindow) {
    let Some(main) = app.get_webview_window("main") else {
        let _ = window.center();
        return;
    };
    let (Ok(main_pos), Ok(main_size), Ok(win_size)) = (
        main.outer_position(),
        main.outer_size(),
        window.outer_size(),
    ) else {
        let _ = window.center();
        return;
    };
    let work_area = window.current_monitor().ok().flatten().map(|monitor| {
        let area = monitor.work_area();
        (
            (area.position.x, area.position.y),
            (area.size.width, area.size.height),
        )
    });
    let (x, y) = centered_position(
        (main_pos.x, main_pos.y),
        (main_size.width, main_size.height),
        (win_size.width, win_size.height),
        work_area,
    );
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

#[tauri::command]
async fn open_settings_window(app: tauri::AppHandle, tab: Option<String>) -> Result<(), String> {
    let url_path = match tab.as_deref() {
        Some(t) if !t.is_empty() => format!("settings.html?tab={}", t),
        _ => "settings.html".to_string(),
    };

    if let Some(window) = app.get_webview_window("settings") {
        // Hidden with its owner while the main window was minimized, so undo that
        // before raising it.
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        if let Some(t) = tab.as_deref().filter(|s| !s.is_empty()) {
            // emit() serializes via JSON — no string-escape footgun, unlike
            // eval() with format!(). Frontend listens via Tauri event API.
            let _ = window.emit("kite:settings-tab", t);
        }
        return Ok(());
    }

    let main_inner = app.get_webview_window("main").and_then(|main| {
        let scale = main.scale_factor().ok()?;
        let size = main.inner_size().ok()?.to_logical::<f64>(scale);
        Some((size.width as u32, size.height as u32))
    });
    let (width, height) = settings_inner_size(main_inner);

    let builder = WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App(url_path.into()))
        .title("Settings")
        .inner_size(width as f64, height as f64)
        .min_inner_size(640.0, 480.0)
        .resizable(true)
        .visible(false);

    // Tie lifecycle to the main window so settings minimizes/closes with it.
    // macOS: skip parent() — child + always_on_top leaves the settings webview
    // behind the main window except while the parent is being dragged (#33).
    #[cfg(not(target_os = "macos"))]
    let builder = if let Some(main) = app.get_webview_window("main") {
        builder.parent(&main).map_err(|e| e.to_string())?
    } else {
        builder
    };

    // macOS skips parent() above, so always_on_top is the only thing keeping
    // settings above the main window there (#33). Windows and Linux get that from
    // the parent/owner relationship: an owned window is always above its owner.
    // Marking it topmost on those platforms would also float it above every other
    // app and pin it over the main window's own header controls.
    #[cfg(target_os = "macos")]
    let builder = builder.always_on_top(true);

    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);

    // On Linux/Windows we render our own titlebar, so drop native chrome
    // and make the window transparent.
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let builder = builder.decorations(false).transparent(true);

    let window = builder.build().map_err(|e| e.to_string())?;

    // Some Linux compositors (GNOME/Mutter with CSD-by-default) ignore the
    // builder-time decorations flag — re-assert it after realize.
    #[cfg(target_os = "linux")]
    {
        let _ = window.set_decorations(false);
    }

    // Still hidden here: the settings webview calls show() after its first
    // paint, so placing it now costs no visible jump.
    center_over_main(&app, &window);

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
                // The settings window is centered on the main window every time it
                // opens, so a persisted position would fight that placement.
                .with_denylist(&["settings"])
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
        centered_position, parse_launch_dir_from_paths, resolve_secondary_executable,
        secondary_matches_current_executable, settings_inner_size,
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
    fn settings_size_falls_back_to_the_design_size() {
        assert_eq!(settings_inner_size(None), (900, 700));
        assert_eq!(settings_inner_size(Some((1600, 1000))), (900, 700));
    }

    #[test]
    fn settings_size_shrinks_to_fit_the_default_main_window() {
        assert_eq!(settings_inner_size(Some((800, 600))), (720, 520));
    }

    #[test]
    fn settings_size_stops_at_a_usable_floor() {
        assert_eq!(settings_inner_size(Some((400, 300))), (680, 520));
    }

    #[test]
    fn centers_over_the_anchor_window() {
        assert_eq!(
            centered_position((100, 200), (1000, 800), (900, 700), None),
            (150, 250)
        );
    }

    #[test]
    fn keeps_an_oversized_window_inside_the_work_area() {
        // Main window smaller than the settings window: plain centering would put
        // it at x = -58, off the left edge.
        assert_eq!(
            centered_position(
                (-8, -8),
                (800, 600),
                (916, 708),
                Some(((0, 0), (1920, 1040)))
            ),
            (0, 0)
        );
    }

    #[test]
    fn clamps_to_the_far_work_area_edge() {
        assert_eq!(
            centered_position(
                (1800, 900),
                (800, 600),
                (900, 700),
                Some(((0, 0), (1920, 1040)))
            ),
            (1020, 340)
        );
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
