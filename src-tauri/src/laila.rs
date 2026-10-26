//! Laila'nın masaüstü penceresi: görev çubuğu üzerinde gezinen, saydam ve her zaman üstte küçük pencere.
//! Pencere "laila" etiketiyle açılır, düzen dosyasında izlenmez.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewUrl,
    WebviewWindowBuilder,
};

pub const LAILA_LABEL: &str = "laila";
const RETURN_EVENT: &str = "alpicim://laila-return";
const MAX_SIZE: u32 = 600;
/// "Her zaman üstte" bayrağı en çok bu aralıkla (ms) yeniden uygulanır.
const TOP_REASSERT_MS: u64 = 2000;

static LAST_TOP_MS: AtomicU64 = AtomicU64::new(0);

/// Birincil monitör (fiziksel piksel) ve çalışma alanının alt kenarı.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LailaGeometry {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    work_bottom: i32,
    scale: f64,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Masaüstü penceresini oluşturur (gizli başlar; ilk `laila_place` çağrısı gösterir).
#[tauri::command]
pub async fn laila_desktop_show<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    if app.get_webview_window(LAILA_LABEL).is_some() {
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, LAILA_LABEL, WebviewUrl::App("index.html".into()))
        .title("Laila")
        .inner_size(72.0, 96.0)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .focusable(false)
        .visible(false)
        .disable_drag_drop_handler()
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn laila_geometry<R: Runtime>(app: AppHandle<R>) -> Result<LailaGeometry, String> {
    let monitor = match app.primary_monitor() {
        Ok(Some(m)) => m,
        _ => app
            .available_monitors()
            .map_err(|e| e.to_string())?
            .into_iter()
            .next()
            .ok_or_else(|| "Monitör bulunamadı".to_string())?,
    };
    let pos = monitor.position();
    let size = monitor.size();
    let work = monitor.work_area();
    let work_bottom = work.position.y + work.size.height as i32;
    Ok(LailaGeometry {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
        work_bottom,
        scale: monitor.scale_factor(),
    })
}

/// Pencereyi fiziksel piksel cinsinden yerleştirir; görünür değilse odaklamadan gösterir.
#[tauri::command]
pub fn laila_place<R: Runtime>(
    app: AppHandle<R>,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<(), String> {
    if !(1..=MAX_SIZE).contains(&width) || !(1..=MAX_SIZE).contains(&height) {
        return Err("Geçersiz boyut".into());
    }
    let Some(window) = app.get_webview_window(LAILA_LABEL) else {
        return Ok(());
    };
    window
        .set_size(PhysicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    if !window.is_visible().unwrap_or(false) {
        window.show().map_err(|e| e.to_string())?;
        LAST_TOP_MS.store(0, Ordering::Relaxed);
    }
    let now = now_ms();
    if now.saturating_sub(LAST_TOP_MS.load(Ordering::Relaxed)) >= TOP_REASSERT_MS {
        LAST_TOP_MS.store(now, Ordering::Relaxed);
        let _ = window.set_always_on_top(true);
    }
    Ok(())
}

/// Eve dönüş olayını yayar ve masaüstü penceresini kapatır.
#[tauri::command]
pub async fn laila_desktop_hide<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let _ = app.emit(RETURN_EVENT, ());
    if let Some(window) = app.get_webview_window(LAILA_LABEL) {
        window.destroy().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn laila_open_main<R: Runtime>(app: AppHandle<R>) {
    crate::windows::show_main(&app);
}


/// Bir pencerenin üst kenarı (fiziksel piksel): Laila'nın üstüne çıkabileceği "çıkıntı".
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Ledge {
    x: i32,
    y: i32,
    width: u32,
}

const MAX_LEDGES: usize = 30;

/// Birincil monitördeki görünür, simge durumunda olmayan, gizlenmemiş (cloaked) üst düzey pencerelerin üst kenarları.
/// Yalnızca okur: başka pencerelere dokunmaz. Alpicim'in kendi pencereleri hariç tutulur.
#[tauri::command]
pub fn laila_window_ledges<R: Runtime>(app: AppHandle<R>) -> Vec<Ledge> {
    let Ok(Some(monitor)) = app.primary_monitor() else {
        return Vec::new();
    };
    let pos = monitor.position();
    let size = monitor.size();
    let bounds = (pos.x, pos.y, pos.x + size.width as i32, pos.y + size.height as i32);
    ledges_impl::collect(bounds)
}

/// Üstte duran bir dikdörtgen (sol, üst, sağ, alt), altındaki pencerenin kenarını örtüyor mu?
fn covered(rects: &[(i32, i32, i32, i32)], px: i32, py: i32) -> bool {
    rects.iter().any(|&(l, t, r, b)| px > l && px < r && py > t && py < b)
}

#[cfg(windows)]
mod ledges_impl {
    use super::{covered, Ledge, MAX_LEDGES};
    use windows::core::BOOL;
    use windows::Win32::Foundation::{HWND, LPARAM, RECT};
    use windows::Win32::Graphics::Dwm::{
        DwmGetWindowAttribute, DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetClassNameW, GetWindowLongW, GetWindowTextLengthW, GetWindowThreadProcessId,
        IsIconic, IsWindowVisible, GWL_EXSTYLE, WS_EX_TOOLWINDOW,
    };

    struct Acc {
        bounds: (i32, i32, i32, i32),
        own_pid: u32,
        rects: Vec<(i32, i32, i32, i32)>,
        out: Vec<Ledge>,
    }

    fn class_name(h: HWND) -> String {
        let mut buf = [0u16; 128];
        let n = unsafe { GetClassNameW(h, &mut buf) }.max(0) as usize;
        String::from_utf16_lossy(&buf[..n.min(buf.len())])
    }

    unsafe fn frame(h: HWND) -> Option<(i32, i32, i32, i32)> {
        let mut rc = RECT::default();
        DwmGetWindowAttribute(
            h,
            DWMWA_EXTENDED_FRAME_BOUNDS,
            &mut rc as *mut _ as *mut core::ffi::c_void,
            std::mem::size_of::<RECT>() as u32,
        )
        .ok()?;
        Some((rc.left, rc.top, rc.right, rc.bottom))
    }

    unsafe extern "system" fn enum_proc(h: HWND, lparam: LPARAM) -> BOOL {
        let acc = &mut *(lparam.0 as *mut Acc);
        if acc.out.len() >= MAX_LEDGES {
            return BOOL(0);
        }
        if !IsWindowVisible(h).as_bool() || IsIconic(h).as_bool() {
            return BOOL(1);
        }
        let mut cloaked = 0u32;
        if DwmGetWindowAttribute(h, DWMWA_CLOAKED, &mut cloaked as *mut _ as *mut core::ffi::c_void, 4).is_ok()
            && cloaked != 0
        {
            return BOOL(1);
        }
        if (GetWindowLongW(h, GWL_EXSTYLE) as u32) & WS_EX_TOOLWINDOW.0 != 0 {
            return BOOL(1);
        }
        if GetWindowTextLengthW(h) == 0 {
            return BOOL(1);
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(h, Some(&mut pid));
        if pid == acc.own_pid {
            return BOOL(1);
        }
        if matches!(
            class_name(h).as_str(),
            "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd"
        ) {
            return BOOL(1);
        }
        let Some((l, t, r, b)) = frame(h) else {
            return BOOL(1);
        };
        if r <= l || b <= t {
            return BOOL(1);
        }
        let (ml, mt, mr, mb) = acc.bounds;
        // Z sırasında yukarıdan aşağıya gelinir: üstteki pencere kenarı örtüyorsa çıkıntı sayılmaz.
        let mid = l + (r - l) / 2;
        let visible_edge = !covered(&acc.rects, mid, t + 1);
        acc.rects.push((l, t, r, b));
        let cl = l.max(ml);
        let cr = r.min(mr);
        if visible_edge && t >= mt && t < mb && cr > cl {
            acc.out.push(Ledge { x: cl, y: t, width: (cr - cl) as u32 });
        }
        BOOL(1)
    }

    pub fn collect(bounds: (i32, i32, i32, i32)) -> Vec<Ledge> {
        let mut acc = Acc { bounds, own_pid: std::process::id(), rects: Vec::new(), out: Vec::new() };
        unsafe {
            let _ = EnumWindows(Some(enum_proc), LPARAM(&mut acc as *mut _ as isize));
        }
        acc.out
    }
}

#[cfg(not(windows))]
mod ledges_impl {
    use super::Ledge;
    pub fn collect(_bounds: (i32, i32, i32, i32)) -> Vec<Ledge> {
        Vec::new()
    }
}

#[cfg(test)]
mod tests {
    use super::covered;

    #[test]
    fn covered_requires_strictly_inside() {
        let rects = [(0, 0, 100, 100)];
        assert!(covered(&rects, 50, 50));
        assert!(!covered(&rects, 50, 0));
        assert!(!covered(&rects, 150, 50));
    }
}
