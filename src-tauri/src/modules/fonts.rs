//! System font enumeration for the settings font pickers.
//!
//! The webview cannot enumerate installed fonts from CSS, so this module
//! exposes one command that walks the OS font set and returns normalized
//! family names plus monospace / CJK flags. Non-Windows platforms return an
//! empty list for now (native enumerators land per platform); the frontend
//! keeps its free-text input either way.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct FontFamilyInfo {
    pub family: String,
    pub monospace: bool,
    pub cjk: bool,
}

#[cfg(target_os = "windows")]
mod platform {
    use super::FontFamilyInfo;
    use std::collections::BTreeSet;
    use windows_sys::Win32::Foundation::LPARAM;
    use windows_sys::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, EnumFontFamiliesExW, FONTENUMPROCW, LOGFONTW,
        TEXTMETRICW, TMPF_FIXED_PITCH,
    };


    // GDI reports charset bits per face; the CJK set we care about.
    const GB2312_CHARSET: u8 = 134;
    const CHINESEBIG5_CHARSET: u8 = 136;
    const HANGUL_CHARSET: u8 = 129;
    const SHIFTJIS_CHARSET: u8 = 128;
    const DEFAULT_CHARSET: u8 = 1;

    unsafe extern "system" fn enum_proc(
        logfont: *const LOGFONTW,
        metric: *const TEXTMETRICW,
        _type: u32,
        lparam: LPARAM,
    ) -> i32 {
        let face = &*logfont;
        let tm = &*metric;
        let family = widestr_to_string(face.lfFaceName.as_ptr());
        if family.is_empty() || family.starts_with('@') {
            return 1; // continue enumeration
        }
        // Inverted bit: set means NOT fixed pitch (GDI historical quirk).
        let monospace = (tm.tmPitchAndFamily & TMPF_FIXED_PITCH) == 0;
        let cjk = matches!(
            tm.tmCharSet,
            GB2312_CHARSET | CHINESEBIG5_CHARSET | HANGUL_CHARSET | SHIFTJIS_CHARSET
        );
        let out = lparam as *mut BTreeSet<(String, bool, bool)>;
        (*out).insert((family, monospace, cjk));
        1
    }

    unsafe fn widestr_to_string(ptr: *const u16) -> String {
        if ptr.is_null() {
            return String::new();
        }
        let mut len = 0usize;
        while *ptr.add(len) != 0 {
            len += 1;
        }
        String::from_utf16_lossy(std::slice::from_raw_parts(ptr, len))
    }

    pub fn enumerate_families() -> Vec<FontFamilyInfo> {
        let mut set: BTreeSet<(String, bool, bool)> = BTreeSet::new();
        unsafe {
            let hdc = CreateCompatibleDC(std::ptr::null_mut());
            if hdc.is_null() {
                return Vec::new();
            }
            // lfCharSet = DEFAULT_CHARSET enumerates every family regardless
            // of the DC's current charset; zeroed pitch/family accepts all.
            let mut logfont: LOGFONTW = std::mem::zeroed();
            logfont.lfCharSet = DEFAULT_CHARSET;
            let proc: FONTENUMPROCW = Some(enum_proc);
            EnumFontFamiliesExW(
                hdc,
                &logfont,
                proc,
                &mut set as *mut _ as isize,
                0,
            );
            DeleteDC(hdc);
        }
        set.into_iter()
            .map(|(family, monospace, cjk)| FontFamilyInfo {
                family,
                monospace,
                cjk,
            })
            .collect()
    }
}

#[cfg(target_os = "windows")]
pub use platform::enumerate_families;

#[cfg(target_os = "macos")]
mod platform {
    use super::FontFamilyInfo;
    use objc2_core_foundation::{CFArray, CFType};
    use objc2_core_text::{
        CTFont, CTFontCollection, CTFontDescriptor, CTFontSymbolicTraits,
    };
    use std::collections::BTreeSet;

    // A CJK ideograph every real CJK family covers; checked against the
    // font's character set because CoreText has no coverage query by range.
    const CJK_PROBE: u32 = 0x6f22; // 漢

    pub fn enumerate_families() -> Vec<FontFamilyInfo> {
        let mut set: BTreeSet<(String, bool, bool)> = BTreeSet::new();
        unsafe {
            let collection = CTFontCollection::from_available_fonts(None);
            let Some(descriptors) = collection.matching_font_descriptors() else {
                return Vec::new();
            };
            let descriptors: &CFArray<CFType> = &descriptors;
            for index in 0..descriptors.len() {
                let Some(element) = descriptors.get(index) else {
                    continue;
                };
                let Ok(descriptor) = element.downcast::<CTFontDescriptor>() else {
                    continue;
                };
                let font = CTFont::with_font_descriptor(&descriptor, 12.0, None);
                let name = font.family_name().to_string();
                if name.is_empty() {
                    continue;
                }
                let traits: CTFontSymbolicTraits = font.symbolic_traits();
                let monospace = traits.contains(CTFontSymbolicTraits::TraitMonoSpace);
                let cjk = font.character_set().is_long_character_member(CJK_PROBE);
                set.insert((name, monospace, cjk));
            }
        }
        set.into_iter()
            .map(|(family, monospace, cjk)| FontFamilyInfo {
                family,
                monospace,
                cjk,
            })
            .collect()
    }
}

#[cfg(target_os = "macos")]
pub use platform::enumerate_families;

#[cfg(target_os = "linux")]
mod platform {
    use super::FontFamilyInfo;
    use std::collections::BTreeSet;
    use std::process::Command;

    // fc-list ships with fontconfig everywhere a desktop terminal runs. The
    // `family` + `spacing` template gives one line per (family, style) pair;
    // spacing=100 (mono) comes from fontconfig's computed pitch. A missing
    // binary degrades to an empty catalog, not an error.
    pub fn enumerate_families() -> Vec<FontFamilyInfo> {
        let output = Command::new("fc-list")
            .arg("--format=%{family}|%{spacing}\\n")
            .output();
        let Ok(output) = output else {
            return Vec::new();
        };
        if !output.status.success() {
            return Vec::new();
        }
        parse_fc_list(&String::from_utf8_lossy(&output.stdout))
    }

    pub(crate) fn parse_fc_list(text: &str) -> Vec<FontFamilyInfo> {
        let mut set: BTreeSet<(String, bool)> = BTreeSet::new();
        for line in text.lines() {
            let Some((family, spacing)) = line.split_once('|') else {
                continue;
            };
            // family can list multiple comma-separated names; the first is
            // the preferred one, which is what a picker should show.
            let Some(first) = family.split(',').next() else {
                continue;
            };
            let name = first.trim();
            if name.is_empty() {
                continue;
            }
            let monospace = spacing.trim() == "100";
            set.insert((name.to_string(), monospace));
        }
        set.into_iter()
            .map(|(family, monospace)| FontFamilyInfo {
                family,
                monospace,
                // fontconfig has no charset field in this template; the CJK
                // hint comes from the frontend's own candidate list.
                cjk: false,
            })
            .collect()
    }

    #[cfg(test)]
    mod tests {
        use super::parse_fc_list;

        #[test]
        fn parses_family_and_monospace_flag() {
            let fonts = parse_fc_list("Monospace|100\nSans|0\n");
            let names: Vec<(&str, bool)> = fonts
                .iter()
                .map(|f| (f.family.as_str(), f.monospace))
                .collect();
            assert_eq!(
                names,
                vec![("Monospace", true), ("Sans", false)]
            );
        }

        #[test]
        fn keeps_the_preferred_family_of_multi_name_lines() {
            let fonts = parse_fc_list("Noto Sans SC, 思源黑体|0\n");
            assert_eq!(fonts.len(), 1);
            assert_eq!(fonts[0].family, "Noto Sans SC");
        }

        #[test]
        fn skips_malformed_and_empty_lines() {
            assert!(parse_fc_list("no-separator\n|100\n\n").is_empty());
        }
    }
}

#[cfg(target_os = "linux")]
pub use platform::enumerate_families;

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
pub fn enumerate_families() -> Vec<FontFamilyInfo> {
    Vec::new()
}

#[tauri::command]
pub fn list_fonts() -> Vec<FontFamilyInfo> {
    enumerate_families()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_at_least_the_bundled_defaults_on_windows() {
        let fonts = enumerate_families();
        #[cfg(target_os = "windows")]
        {
            assert!(!fonts.is_empty());
            // GDI reports localized family names: 微软雅黑 on zh-CN Windows,
            // Microsoft YaHei elsewhere. Either spelling proves CJK coverage.
            let names: Vec<&str> = fonts.iter().map(|f| f.family.as_str()).collect();
            assert!(
                names.contains(&"Microsoft YaHei") || names.contains(&"微软雅黑"),
                "expected a stock CJK family, got: {names:?}"
            );
            assert!(
                fonts.iter().any(|f| f.monospace),
                "expected at least one fixed-pitch family, got {fonts:?}"
            );
        }
    }

    #[test]
    fn command_returns_same_shape_as_enumerator() {
        assert_eq!(list_fonts().len(), enumerate_families().len());
    }
}
