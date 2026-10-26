//! Ekran görüntüsü: sanal ekran GDI ile yakalanır, saydam "snip" penceresinde seçilen bölge PNG olarak kaydedilir
//! (`%USERPROFILE%\Pictures\Alpicim\`) ve panoya CF_DIB olarak konur. Ekran kaydı için kodlayıcı yoktur:
//! Windows'un kendi kaydedicisi (`ms-screenclip:`) açılır.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewUrl, WebviewWindowBuilder};

pub const SNIP_LABEL: &str = "snip";
const DONE_EVENT: &str = "alpicim://snip-done";

#[allow(dead_code)]
struct Shot {
    x: i32,
    y: i32,
    w: u32,
    h: u32,
    /// Yukarıdan aşağıya, BGRA.
    bgra: Vec<u8>,
    restore_main: bool,
}

static SHOT: Mutex<Option<Shot>> = Mutex::new(None);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnipDone {
    pub path: String,
}

/// Pencere oranlarından (0..1) piksel dikdörtgeni; çok küçük/geçersizse None. Saf fonksiyon (testli).
pub fn frac_to_rect(fx: f64, fy: f64, fw: f64, fh: f64, w: u32, h: u32) -> Option<(u32, u32, u32, u32)> {
    if ![fx, fy, fw, fh].iter().all(|v| v.is_finite()) || fw <= 0.0 || fh <= 0.0 {
        return None;
    }
    let x0 = (fx.clamp(0.0, 1.0) * w as f64).round() as u32;
    let y0 = (fy.clamp(0.0, 1.0) * h as f64).round() as u32;
    let x1 = ((fx + fw).clamp(0.0, 1.0) * w as f64).round() as u32;
    let y1 = ((fy + fh).clamp(0.0, 1.0) * h as f64).round() as u32;
    let (rw, rh) = (x1.saturating_sub(x0), y1.saturating_sub(y0));
    (rw >= 4 && rh >= 4).then_some((x0, y0, rw, rh))
}

/// BGRA görüntüden dikdörtgen keser (sınır dışı → None).
pub fn crop(bgra: &[u8], w: u32, h: u32, rx: u32, ry: u32, rw: u32, rh: u32) -> Option<Vec<u8>> {
    if rx.checked_add(rw)? > w || ry.checked_add(rh)? > h || bgra.len() != (w as usize) * (h as usize) * 4 {
        return None;
    }
    let mut out = Vec::with_capacity((rw as usize) * (rh as usize) * 4);
    for row in ry..ry + rh {
        let s = ((row as usize) * (w as usize) + rx as usize) * 4;
        out.extend_from_slice(&bgra[s..s + (rw as usize) * 4]);
    }
    Some(out)
}

/// BGRA → RGBA, alfa 255 (ekran yakalamada alfa anlamsızdır).
pub fn bgra_to_rgba(bgra: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(bgra.len());
    for p in bgra.chunks_exact(4) {
        out.extend_from_slice(&[p[2], p[1], p[0], 255]);
    }
    out
}

/// CF_DIB içeriği: BITMAPINFOHEADER (40) + alttan üste 32 bpp BGRA satırları.
pub fn dib_bytes(bgra: &[u8], w: u32, h: u32) -> Vec<u8> {
    let mut out = Vec::with_capacity(40 + bgra.len());
    out.extend_from_slice(&40u32.to_le_bytes());
    out.extend_from_slice(&(w as i32).to_le_bytes());
    out.extend_from_slice(&(h as i32).to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&32u16.to_le_bytes());
    out.extend_from_slice(&0u32.to_le_bytes()); // BI_RGB
    out.extend_from_slice(&(bgra.len() as u32).to_le_bytes());
    out.extend_from_slice(&[0u8; 16]);
    let stride = (w as usize) * 4;
    for row in (0..h as usize).rev() {
        out.extend_from_slice(&bgra[row * stride..(row + 1) * stride]);
    }
    out
}

fn encode_png(w: u32, h: u32, rgba: &[u8]) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    {
        let mut enc = png::Encoder::new(&mut out, w, h);
        enc.set_color(png::ColorType::Rgba);
        enc.set_depth(png::BitDepth::Eight);
        let mut writer = enc.write_header().map_err(|e| e.to_string())?;
        writer.write_image_data(rgba).map_err(|e| e.to_string())?;
    }
    Ok(out)
}

fn pictures_dir() -> Result<PathBuf, String> {
    let home = std::env::var_os("USERPROFILE").ok_or("Kullanıcı klasörü bulunamadı")?;
    Ok(PathBuf::from(home).join("Pictures").join("Alpicim"))
}

/// Kayıt klasörü içinde mi (yol kaçışına karşı)?
fn inside_pictures(path: &Path) -> bool {
    let Ok(dir) = pictures_dir() else { return false };
    let Ok(dir) = dir.canonicalize() else { return false };
    path.canonicalize().map(|p| p.starts_with(&dir)).unwrap_or(false)
}

#[cfg(windows)]
mod win {
    use windows::core::{w, PCWSTR};
    use windows::Win32::Foundation::{GlobalFree, HANDLE, HGLOBAL, HWND};
    use windows::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits, ReleaseDC,
        SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, CAPTUREBLT, DIB_RGB_COLORS, HGDIOBJ, SRCCOPY,
    };
    use windows::Win32::System::DataExchange::{CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData};
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
    use windows::Win32::System::SystemInformation::GetLocalTime;
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN, SW_SHOWNORMAL,
    };

    const CF_DIB: u32 = 8;

    /// Sanal ekranın (tüm monitörler) fiziksel piksel dikdörtgeni.
    pub fn virtual_screen() -> (i32, i32, u32, u32) {
        unsafe {
            (
                GetSystemMetrics(SM_XVIRTUALSCREEN),
                GetSystemMetrics(SM_YVIRTUALSCREEN),
                GetSystemMetrics(SM_CXVIRTUALSCREEN).max(0) as u32,
                GetSystemMetrics(SM_CYVIRTUALSCREEN).max(0) as u32,
            )
        }
    }

    pub fn capture() -> Result<(i32, i32, u32, u32, Vec<u8>), String> {
        let (x, y, w, h) = virtual_screen();
        if w == 0 || h == 0 || (w as u64 * h as u64) > 120_000_000 {
            return Err("Ekran boyutu okunamadı".into());
        }
        unsafe {
            let screen = GetDC(None);
            if screen.is_invalid() {
                return Err("Ekran bağlamı alınamadı".into());
            }
            let mem = CreateCompatibleDC(Some(screen));
            let bmp = CreateCompatibleBitmap(screen, w as i32, h as i32);
            let old = SelectObject(mem, HGDIOBJ(bmp.0));
            let blt = BitBlt(mem, 0, 0, w as i32, h as i32, Some(screen), x, y, SRCCOPY | CAPTUREBLT);
            let mut buf = vec![0u8; (w as usize) * (h as usize) * 4];
            let mut bmi = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: w as i32,
                    biHeight: -(h as i32),
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    ..Default::default()
                },
                ..Default::default()
            };
            let lines = GetDIBits(mem, bmp, 0, h, Some(buf.as_mut_ptr() as *mut _), &mut bmi, DIB_RGB_COLORS);
            SelectObject(mem, old);
            let _ = DeleteObject(HGDIOBJ(bmp.0));
            let _ = DeleteDC(mem);
            ReleaseDC(None, screen);
            blt.map_err(|e| e.to_string())?;
            if lines == 0 {
                return Err("Ekran görüntüsü alınamadı".into());
            }
            Ok((x, y, w, h, buf))
        }
    }

    /// Dosya adı için yerel zaman damgası: YYYY-MM-DD_HHMMSS.
    pub fn timestamp() -> String {
        let t = unsafe { GetLocalTime() };
        format!("{:04}-{:02}-{:02}_{:02}{:02}{:02}", t.wYear, t.wMonth, t.wDay, t.wHour, t.wMinute, t.wSecond)
    }

    /// Görüntüyü panoya CF_DIB olarak yazar. `owner`: pano sahibi olacak pencere (null olamaz).
    pub fn set_clipboard_dib(owner: HWND, dib: &[u8]) -> Result<(), String> {
        unsafe {
            let mut opened = false;
            for _ in 0..8 {
                if OpenClipboard(Some(owner)).is_ok() {
                    opened = true;
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(25));
            }
            if !opened {
                return Err("Pano başka bir uygulama tarafından kullanılıyor".into());
            }
            let result = (|| {
                EmptyClipboard().map_err(|e| e.to_string())?;
                let g: HGLOBAL = GlobalAlloc(GMEM_MOVEABLE, dib.len()).map_err(|e| e.to_string())?;
                let p = GlobalLock(g) as *mut u8;
                if p.is_null() {
                    let _ = GlobalFree(Some(g));
                    return Err("Bellek ayrılamadı".to_string());
                }
                std::ptr::copy_nonoverlapping(dib.as_ptr(), p, dib.len());
                let _ = GlobalUnlock(g);
                if let Err(e) = SetClipboardData(CF_DIB, Some(HANDLE(g.0))) {
                    let _ = GlobalFree(Some(g));
                    return Err(e.to_string());
                }
                Ok(())
            })();
            let _ = CloseClipboard();
            result
        }
    }

    /// `ShellExecuteW` ile açar; başarıda true.
    pub fn shell_open(target: &str) -> bool {
        let wide: Vec<u16> = target.encode_utf16().chain(std::iter::once(0)).collect();
        let r = unsafe { ShellExecuteW(None, w!("open"), PCWSTR(wide.as_ptr()), None, None, SW_SHOWNORMAL) };
        r.0 as isize > 32
    }
}

fn restore_main<R: Runtime>(app: &AppHandle<R>, restore: bool) {
    if restore {
        if let Some(main) = app.get_window(crate::windows::MAIN_LABEL) {
            let _ = main.show();
        }
    }
}

async fn sleep_ms(ms: u64) {
    let _ = tauri::async_runtime::spawn_blocking(move || std::thread::sleep(std::time::Duration::from_millis(ms))).await;
}

/// Ekranı yakalar, saydam seçim penceresini açar.
#[tauri::command]
pub async fn snip_start<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    #[cfg(not(windows))]
    {
        let _ = app;
        Err("Yalnızca Windows".into())
    }
    #[cfg(windows)]
    {
        if app.get_webview_window(SNIP_LABEL).is_some() {
            return Ok(());
        }
        // Alpicim penceresi görüntüde görünmesin.
        let main = app.get_window(crate::windows::MAIN_LABEL);
        let restore = main.as_ref().map(|m| m.is_visible().unwrap_or(false)).unwrap_or(false);
        if restore {
            if let Some(m) = &main {
                let _ = m.hide();
            }
            sleep_ms(250).await;
        }
        let shot = tauri::async_runtime::spawn_blocking(win::capture)
            .await
            .map_err(|e| e.to_string())
            .and_then(|r| r);
        let (x, y, w, h, bgra) = match shot {
            Ok(v) => v,
            Err(e) => {
                restore_main(&app, restore);
                return Err(e);
            }
        };
        *SHOT.lock().map_err(|e| e.to_string())? = Some(Shot { x, y, w, h, bgra, restore_main: restore });

        let built = WebviewWindowBuilder::new(&app, SNIP_LABEL, WebviewUrl::App("index.html".into()))
            .title("Alpicim ekran görüntüsü")
            .inner_size(200.0, 200.0)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .visible(false)
            .disable_drag_drop_handler()
            .build();
        match built {
            Ok(win) => {
                let _ = win.set_position(PhysicalPosition::new(x, y));
                let _ = win.set_size(PhysicalSize::new(w, h));
                let _ = win.show();
                let _ = win.set_focus();
                Ok(())
            }
            Err(e) => {
                if let Ok(mut s) = SHOT.lock() {
                    s.take();
                }
                restore_main(&app, restore);
                Err(e.to_string())
            }
        }
    }
}

fn close_snip<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = app.get_webview_window(SNIP_LABEL) {
        let _ = w.destroy();
    }
}

/// Seçimi (pencereye göre 0..1 oranları) kaydeder ve panoya koyar. Yol döner.
#[tauri::command]
pub async fn snip_finish<R: Runtime>(app: AppHandle<R>, fx: f64, fy: f64, fw: f64, fh: f64) -> Result<String, String> {
    let shot = SHOT.lock().map_err(|e| e.to_string())?.take();
    close_snip(&app);
    let Some(shot) = shot else { return Err("Yakalanmış görüntü yok".into()) };
    restore_main(&app, shot.restore_main);
    #[cfg(not(windows))]
    {
        let _ = (fx, fy, fw, fh);
        Err("Yalnızca Windows".into())
    }
    #[cfg(windows)]
    {
        let (rx, ry, rw, rh) = frac_to_rect(fx, fy, fw, fh, shot.w, shot.h).ok_or("Seçim çok küçük")?;
        let bgra = crop(&shot.bgra, shot.w, shot.h, rx, ry, rw, rh).ok_or("Seçim geçersiz")?;
        let dir = pictures_dir()?;
        let owner = app
            .get_webview_window(crate::windows::MAIN_LABEL)
            .and_then(|w| w.hwnd().ok())
            .map(|h| h.0 as isize);
        let (path, clip_err) = tauri::async_runtime::spawn_blocking(move || -> Result<(PathBuf, Option<String>), String> {
            std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
            let png = encode_png(rw, rh, &bgra_to_rgba(&bgra))?;
            let base = win::timestamp();
            let mut path = dir.join(format!("{base}.png"));
            let mut n = 1;
            while path.exists() {
                path = dir.join(format!("{base}-{n}.png"));
                n += 1;
            }
            std::fs::write(&path, png).map_err(|e| e.to_string())?;
            let clip_err = match owner {
                Some(o) => win::set_clipboard_dib(windows::Win32::Foundation::HWND(o as *mut _), &dib_bytes(&bgra, rw, rh)).err(),
                None => Some("Pano sahibi pencere yok".to_string()),
            };
            Ok((path, clip_err))
        })
        .await
        .map_err(|e| e.to_string())??;
        if let Some(e) = &clip_err {
            eprintln!("Ekran görüntüsü panoya yazılamadı: {e}");
        }
        let text = path.to_string_lossy().to_string();
        let _ = app.emit(DONE_EVENT, SnipDone { path: text.clone() });
        Ok(text)
    }
}

#[tauri::command]
pub async fn snip_cancel<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let shot = SHOT.lock().map_err(|e| e.to_string())?.take();
    close_snip(&app);
    restore_main(&app, shot.map(|s| s.restore_main).unwrap_or(false));
    Ok(())
}

/// Kaydedilen görüntüyü Gezgin'de gösterir (yalnızca Alpicim'in resim klasörü içindeki dosyalar).
#[tauri::command]
pub async fn snip_reveal(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !inside_pictures(&p) {
        return Err("Geçersiz yol".into());
    }
    std::process::Command::new("explorer.exe")
        .arg(format!("/select,{}", p.display()))
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Klasörü açar (yoksa oluşturur).
#[tauri::command]
pub async fn snip_open_folder() -> Result<(), String> {
    let dir = pictures_dir()?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::process::Command::new("explorer.exe")
        .arg(&dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Windows'un kendi ekran kaydedicisini açar (`ms-screenclip:`); olmazsa Ekran Alıntısı Aracı.
#[tauri::command]
pub async fn screen_record_open() -> Result<(), String> {
    #[cfg(windows)]
    {
        if win::shell_open("ms-screenclip:?type=recording") || win::shell_open("snippingtool.exe") {
            return Ok(());
        }
    }
    Err("Windows ekran kaydedicisi açılamadı".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frac_rect_rounds_and_clamps() {
        assert_eq!(frac_to_rect(0.0, 0.0, 0.5, 0.5, 200, 100), Some((0, 0, 100, 50)));
        assert_eq!(frac_to_rect(0.9, 0.9, 0.5, 0.5, 100, 100), Some((90, 90, 10, 10)));
        assert_eq!(frac_to_rect(0.0, 0.0, 0.01, 0.5, 100, 100), None);
        assert_eq!(frac_to_rect(f64::NAN, 0.0, 0.5, 0.5, 100, 100), None);
        assert_eq!(frac_to_rect(0.0, 0.0, -1.0, 0.5, 100, 100), None);
    }

    #[test]
    fn crop_extracts_rows() {
        let img: Vec<u8> = (0..4 * 4 * 4).map(|i| i as u8).collect();
        let c = crop(&img, 4, 4, 1, 1, 2, 2).unwrap();
        assert_eq!(c.len(), 16);
        assert_eq!(&c[0..4], &img[(5 * 4)..(5 * 4 + 4)]);
        assert!(crop(&img, 4, 4, 3, 0, 2, 1).is_none());
    }

    #[test]
    fn dib_is_bottom_up() {
        let img = vec![1, 1, 1, 0, 2, 2, 2, 0]; // 1 genişlik, 2 yükseklik
        let d = dib_bytes(&img, 1, 2);
        assert_eq!(d.len(), 40 + 8);
        assert_eq!(&d[40..44], &[2, 2, 2, 0]);
    }

    #[test]
    fn rgba_swaps_channels() {
        assert_eq!(bgra_to_rgba(&[1, 2, 3, 0]), vec![3, 2, 1, 255]);
    }
}
