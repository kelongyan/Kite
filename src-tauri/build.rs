fn main() {
    #[cfg(target_os = "windows")]
    {
        let out_dir = std::env::var("OUT_DIR").unwrap_or_default();
        let target_dir = std::path::PathBuf::from(out_dir);
        if let Some(profile_dir) = target_dir.ancestors().nth(3) {
            let res_dll = std::path::PathBuf::from("resources/WebView2Loader.dll");
            if res_dll.exists() {
                let _ = std::fs::copy(&res_dll, profile_dir.join("WebView2Loader.dll"));
            }
        }
    }
    tauri_build::build();
}
