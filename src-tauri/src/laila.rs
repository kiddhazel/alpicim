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

