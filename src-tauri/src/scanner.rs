//! Yüklü uygulamaları bulma ve simge çıkarma (yalnızca Windows).
//!
//! Tarama kaynakları: Başlat menüsü (tüm kullanıcılar + geçerli kullanıcı) ve masaüstü (kişisel + ortak).
//! Her .lnk kısayolunun hedefi IShellLinkW ile çözülür; hedefi var olan bir .exe olanlar listelenir.
//! Steam/Epic gibi başlatıcıların .url kısayolları da (oyunlar) dahil edilir.
//! Başlatma her zaman kısayolun kendisiyle yapılır; böylece kısayoldaki argümanlar ve çalışma klasörü korunur.
//!
//! Simgeler: SHGetFileInfoW + sistem görüntü listesi (48 px, yoksa 32 px) → PNG → disk önbelleği.

use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};

use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedApp {
    /// Görünen ad (kısayol dosyasının adı)
    pub name: String,
    /// Başlatıcıya eklenecek yol (kısayol dosyası)
    pub path: String,
    /// Çözülmüş hedef: .exe yolu veya .url adresi (kategori tahmini ve gösterim için)
    pub target: String,
    /// Başlat menüsündeki klasör adı (ör. "Steam", "Microsoft Office") — kategori ipucu
    pub folder: String,
    /// "startMenu" | "desktop"
    pub source: String,
}

/// Kısayol adında geçerse listelenmeyecek ifadeler (kaldırıcılar, belgeler, yardımcılar).
const SKIP_NAME_WORDS: &[&str] = &[
    "uninstall", "uninst", "kaldır", "kaldir", "setup", "installer", "readme", "beni oku", "help", "yardım",
    "website", "web sitesi", "documentation", "release notes", "license", "lisans", "changelog", "repair",
    "onar", "debug", "crash", "safe mode", "güvenli mod", "manual", "kılavuz", "support", "destek",
    "eula", "update", "updater", "güncelle",
];

/// Başlat menüsünde atlanacak sistem klasörleri.
const SKIP_FOLDERS: &[&str] = &[
    "startup", "başlangıç", "windows tools", "windows araçları", "administrative tools", "yönetimsel araçlar",
    "accessibility", "erişilebilirlik", "windows powershell", "system tools", "sistem araçları",
    "maintenance", "bakım",
];

pub fn should_skip_name(name: &str) -> bool {
    let n = name.to_lowercase();
    SKIP_NAME_WORDS.iter().any(|w| n.contains(w))
}

fn should_skip_folder(folder: &str) -> bool {
    let f = folder.to_lowercase();
    SKIP_FOLDERS.iter().any(|w| f == *w || f.ends_with(&format!("\\{w}")))
}

/// Hedefe göre atlanacak kısayollar: Windows'un kendi araçları (Uzak Masaüstü hariç), SDK araçları ve Alpicim.
pub fn should_skip_target(target: &str, windir: &str) -> bool {
    let t = target.to_lowercase().replace('/', "\\");
    let file = t.rsplit('\\').next().unwrap_or("");
    if file == "alpicim.exe" || t.contains("\\windows kits\\") {
        return true;
    }
    let win = windir.to_lowercase();
    if !win.is_empty() && t.starts_with(&format!("{}\\", win.trim_end_matches('\\'))) {
        return !["mstsc.exe"].contains(&file);
    }
    false
}

/// .url dosyasından URL= değerini okur (INI biçimi).
pub fn parse_url_file(text: &str) -> Option<String> {
    text.lines()
        .map(str::trim)
        .find_map(|l| l.strip_prefix("URL=").or_else(|| l.strip_prefix("url=")))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Yalnızca oyun/uygulama başlatıcı protokollerini kabul et (web sitesi kısayollarını değil).
pub fn is_app_protocol(url: &str) -> bool {
    let u = url.to_lowercase();
    ["steam://", "com.epicgames.launcher://", "uplay://", "battlenet://", "origin://", "origin2://", "eadm://", "goggalaxy://", "riotclient://"]
        .iter()
        .any(|p| u.starts_with(p))
}

fn collect(dir: &Path, depth: u32, out: &mut Vec<PathBuf>) {
    if depth > 4 {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect(&path, depth + 1, out);
        } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            let ext = ext.to_ascii_lowercase();
            if ext == "lnk" || ext == "url" {
                out.push(path);
            }
        }
    }
}

fn relative_folder(root: &Path, file: &Path) -> String {
    file.parent()
        .and_then(|p| p.strip_prefix(root).ok())
        .map(|p| p.display().to_string())
        .unwrap_or_default()
}

#[cfg(windows)]
mod win {
    use std::path::{Path, PathBuf};

    use ::windows::core::{Interface, HSTRING, PWSTR};
    use ::windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
    };
    use ::windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES;
    use ::windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, IPersistFile, CLSCTX_INPROC_SERVER,
        COINIT_APARTMENTTHREADED, STGM_READ,
    };
    use ::windows::Win32::UI::Controls::IImageList;
    use ::windows::Win32::UI::Shell::{
        FOLDERID_Desktop, IShellLinkW, SHGetFileInfoW, SHGetImageList, SHGetKnownFolderPath,
        ShellLink, KNOWN_FOLDER_FLAG, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON, SHGFI_SYSICONINDEX,
    };
    use ::windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, HICON, ICONINFO};

    const SHIL_EXTRALARGE: i32 = 2;
    const ILD_TRANSPARENT: u32 = 1;

    pub fn com_init() {
        // Zaten başlatılmışsa hata döner; yok sayılır.
        let _ = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
    }

    pub fn desktop_dir() -> Option<PathBuf> {
        unsafe {
            let p: PWSTR = SHGetKnownFolderPath(&FOLDERID_Desktop, KNOWN_FOLDER_FLAG(0), None).ok()?;
            let s = p.to_string().ok();
            CoTaskMemFree(Some(p.0 as _));
            s.map(PathBuf::from)
        }
    }

    /// .lnk hedefini çözer (ortam değişkenleri genişletilmiş tam yol).
    pub fn resolve_lnk(path: &Path) -> Option<String> {
        unsafe {
            let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).ok()?;
            let file: IPersistFile = link.cast().ok()?;
            file.Load(&HSTRING::from(path.to_string_lossy().as_ref()), STGM_READ).ok()?;
            let mut buf = [0u16; 1024];
            link.GetPath(&mut buf, std::ptr::null_mut(), 0).ok()?;
            let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
            let s = String::from_utf16_lossy(&buf[..len]);
            (!s.is_empty()).then_some(s)
        }
    }

    /// Dosyanın kabuk simgesini RGBA piksel olarak döndürür: (genişlik, yükseklik, piksel).
    pub fn shell_icon_rgba(path: &Path) -> Option<(u32, u32, Vec<u8>)> {
        unsafe {
            let wide = HSTRING::from(path.to_string_lossy().as_ref());
            let mut info = SHFILEINFOW::default();
            let ok = SHGetFileInfoW(
                &wide,
                FILE_FLAGS_AND_ATTRIBUTES(0),
                Some(&mut info),
                std::mem::size_of::<SHFILEINFOW>() as u32,
                SHGFI_SYSICONINDEX | SHGFI_ICON | SHGFI_LARGEICON,
            );
            if ok == 0 {
                return None;
            }
            // Mümkünse 48 px'lik "çok büyük" listeden al; olmazsa 32 px'lik simgeyi kullan.
            let mut icon: HICON = info.hIcon;
            let mut extra: Option<HICON> = None;
            if let Ok(list) = SHGetImageList::<IImageList>(SHIL_EXTRALARGE) {
                if let Ok(h) = list.GetIcon(info.iIcon, ILD_TRANSPARENT) {
                    extra = Some(h);
                    icon = h;
                }
            }
            let result = hicon_to_rgba(icon);
            if let Some(h) = extra {
                let _ = DestroyIcon(h);
            }
            if !info.hIcon.is_invalid() {
                let _ = DestroyIcon(info.hIcon);
            }
            result
        }
    }

    unsafe fn hicon_to_rgba(icon: HICON) -> Option<(u32, u32, Vec<u8>)> {
        let mut ii = ICONINFO::default();
        GetIconInfo(icon, &mut ii).ok()?;
        let color = ii.hbmColor;
        let mask = ii.hbmMask;
        let cleanup = || {
            if !color.is_invalid() {
                let _ = DeleteObject(HGDIOBJ(color.0));
            }
            if !mask.is_invalid() {
                let _ = DeleteObject(HGDIOBJ(mask.0));
            }
        };
        if color.is_invalid() {
            cleanup();
            return None;
        }
        let mut bm = BITMAP::default();
        let got = GetObjectW(
            HGDIOBJ(color.0),
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut bm as *mut BITMAP as *mut _),
        );
        if got == 0 || bm.bmWidth <= 0 || bm.bmHeight <= 0 {
            cleanup();
            return None;
        }
        let (w, h) = (bm.bmWidth as u32, bm.bmHeight as u32);
        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: w as i32,
                biHeight: -(h as i32), // yukarıdan aşağı
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };
        let mut pixels = vec![0u8; (w * h * 4) as usize];
        let dc = CreateCompatibleDC(None);
        let lines = GetDIBits(
            dc,
            color,
            0,
            h,
            Some(pixels.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );
        let _ = DeleteDC(dc);
        cleanup();
        if lines == 0 {
            return None;
        }
        // BGRA → RGBA; hiç alfa yoksa (eski simgeler) tamamen opak kabul et.
        let has_alpha = pixels.chunks_exact(4).any(|p| p[3] != 0);
        for p in pixels.chunks_exact_mut(4) {
            p.swap(0, 2);
            if !has_alpha {
                p[3] = 255;
            }
        }
        Some((w, h, pixels))
    }
}

/// Başlat menüsü ve masaüstünü tarar.
#[cfg(windows)]
pub fn scan() -> Vec<ScannedApp> {
    win::com_init();
    let mut roots: Vec<(PathBuf, &'static str)> = Vec::new();
    if let Ok(pd) = std::env::var("ProgramData") {
        roots.push((PathBuf::from(pd).join(r"Microsoft\Windows\Start Menu\Programs"), "startMenu"));
    }
    if let Ok(ad) = std::env::var("APPDATA") {
        roots.push((PathBuf::from(ad).join(r"Microsoft\Windows\Start Menu\Programs"), "startMenu"));
    }
    if let Some(d) = win::desktop_dir() {
        roots.push((d, "desktop"));
    }
    if let Ok(public) = std::env::var("PUBLIC") {
        roots.push((PathBuf::from(public).join("Desktop"), "desktop"));
    }

    let windir = std::env::var("WINDIR").unwrap_or_else(|_| r"C:\Windows".to_string());
    let mut seen_targets: HashSet<String> = HashSet::new();
    let mut seen_names: HashSet<String> = HashSet::new();
    let mut apps = Vec::new();

    for (root, source) in roots {
        let mut files = Vec::new();
        collect(&root, 0, &mut files);
        files.sort();
        for file in files {
            let folder = relative_folder(&root, &file);
            if should_skip_folder(&folder) {
                continue;
            }
            let name = file.file_stem().and_then(|s| s.to_str()).unwrap_or("").trim().to_string();
            if name.is_empty() || should_skip_name(&name) {
                continue;
            }
            let ext = file.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
            let target = if ext == "lnk" {
                match win::resolve_lnk(&file) {
                    Some(t)
                        if t.to_lowercase().ends_with(".exe")
                            && Path::new(&t).exists()
                            && !should_skip_target(&t, &windir) =>
                    {
                        t
                    }
                    _ => continue,
                }
            } else {
                match fs::read_to_string(&file).ok().as_deref().and_then(parse_url_file) {
                    Some(u) if is_app_protocol(&u) => u,
                    _ => continue,
                }
            };
            let target_key = target.to_lowercase();
            let name_key = name.to_lowercase();
            // Aynı hedefe birden çok kısayol olabilir (Başlat menüsü + masaüstü): ilkini tut.
            if !seen_targets.insert(target_key) || !seen_names.insert(name_key) {
                continue;
            }
            apps.push(ScannedApp {
                name,
                path: file.display().to_string(),
                target,
                folder,
                source: source.to_string(),
            });
        }
    }
    apps.sort_by_key(|a| a.name.to_lowercase());
    apps
}

#[cfg(not(windows))]
pub fn scan() -> Vec<ScannedApp> {
    Vec::new()
}

// ---------------------------------------------------------------------------
// Simgeler
// ---------------------------------------------------------------------------

fn fnv(s: &str) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.to_lowercase().bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

fn encode_png(w: u32, h: u32, rgba: &[u8]) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    {
        let mut enc = png::Encoder::new(&mut out, w, h);
        enc.set_color(png::ColorType::Rgba);
        enc.set_depth(png::BitDepth::Eight);
        let mut writer = enc.write_header().ok()?;
        writer.write_image_data(rgba).ok()?;
    }
    Some(out)
}

/// Simgeyi PNG data URL olarak döndürür; önbellek: `<cache>/icons/<hash>.png`.
pub fn icon_data_url(cache_dir: &Path, path: &Path) -> Option<String> {
    use base64::Engine;
    let key = format!("{:016x}", fnv(&path.display().to_string()));
    let file = cache_dir.join("icons").join(format!("{key}.png"));

    let bytes = match fs::read(&file) {
        Ok(b) if !b.is_empty() => b,
        _ => {
            #[cfg(windows)]
            let png = {
                win::com_init();
                let (w, h, rgba) = win::shell_icon_rgba(path)?;
                encode_png(w, h, &rgba)?
            };
            #[cfg(not(windows))]
            let png: Vec<u8> = {
                let _ = encode_png;
                return None;
            };
            let _ = fs::create_dir_all(file.parent()?);
            let _ = fs::write(&file, &png);
            png
        }
    };
    Some(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skips_uninstallers_and_docs() {
        assert!(should_skip_name("Uninstall Foo"));
        assert!(should_skip_name("Foo Kaldır"));
        assert!(should_skip_name("Foo Readme"));
        assert!(!should_skip_name("Discord"));
        assert!(!should_skip_name("Counter-Strike 2"));
    }

    #[test]
    fn skips_system_folders() {
        assert!(should_skip_folder("Startup"));
        assert!(should_skip_folder("Windows Araçları"));
        assert!(!should_skip_folder("Steam"));
        assert!(!should_skip_folder(""));
    }

    #[test]
    fn parses_steam_url_shortcut() {
        let text = "[{000214A0-0000-0000-C000-000000000046}]\r\nProp3=19,0\r\n[InternetShortcut]\r\nIDList=\r\nIconIndex=0\r\nURL=steam://rungameid/730\r\nIconFile=D:\\steam\\steam\\games\\x.ico\r\n";
        let url = parse_url_file(text).unwrap();
        assert_eq!(url, "steam://rungameid/730");
        assert!(is_app_protocol(&url));
        assert!(!is_app_protocol("https://example.com"));
    }

    #[test]
    fn skips_windows_and_sdk_tools() {
        let w = r"C:\WINDOWS";
        assert!(should_skip_target(r"C:\Windows\System32\cmd.exe", w));
        assert!(should_skip_target(r"C:\Windows\system32\psr.exe", w));
        assert!(!should_skip_target(r"C:\WINDOWS\system32\mstsc.exe", w));
        assert!(should_skip_target(r"C:\Program Files (x86)\Windows Kits\10\App Certification Kit\appcertui.exe", w));
        assert!(should_skip_target(r"C:\Users\x\OneDrive\Desktop\Alpicim\alpicim.exe", w));
        assert!(!should_skip_target(r"C:\Program Files\Google\Chrome\Application\chrome.exe", w));
        assert!(!should_skip_target(r"C:\WindowsApps\x.exe", w));
    }

    #[test]
    fn hash_is_case_insensitive() {
        assert_eq!(fnv("C:\\A.exe"), fnv("c:\\a.EXE"));
    }
}
