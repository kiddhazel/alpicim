//! Hızlı pencere (Spotlight + hızlı pano): ortada, kenarlıksız, her zaman üstte küçük arama kutusu.
//! Pencere "quick" etiketiyle ilk kullanımda oluşturulur, sonra gizlenip yeniden gösterilir.
//! Odak kaybedince kendini gizler. Düzen dosyasında izlenmez.

use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder, WindowEvent};

pub const QUICK_LABEL: &str = "quick";
const QUICK_EVENT: &str = "alpicim://quick";

/// Pencerenin son istenen kipi: "search" | "clipboard" (webview açılışta okur, sonra olayı dinler).
static MODE: Mutex<&'static str> = Mutex::new("search");

fn set_mode(mode: &'static str) {
    *MODE.lock().unwrap_or_else(|e| e.into_inner()) = mode;
}

/// Kısayoldan çağrılır (herhangi bir iş parçacığı): pencere işini async görevde yapar.
pub fn show<R: Runtime>(app: &AppHandle<R>, mode: &'static str) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(err) = show_inner(&app, mode) {
            eprintln!("Hızlı pencere açılamadı: {err}");
        }
    });
}

fn show_inner<R: Runtime>(app: &AppHandle<R>, mode: &'static str) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(QUICK_LABEL) {
        // Aynı kısayola yeniden basmak pencereyi kapatır.
        if window.is_visible().unwrap_or(false) && *MODE.lock().unwrap_or_else(|e| e.into_inner()) == mode {
            let _ = window.hide();
            return Ok(());
        }
        set_mode(mode);
        let _ = window.center();
        window.show().map_err(|e| e.to_string())?;
        let _ = window.set_always_on_top(true);
        let _ = window.set_focus();
        let _ = app.emit_to(QUICK_LABEL, QUICK_EVENT, mode);
        return Ok(());
    }
    set_mode(mode);
    let window = WebviewWindowBuilder::new(app, QUICK_LABEL, WebviewUrl::App("index.html".into()))
        .title("Alpicim")
        .inner_size(640.0, 440.0)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .center()
        .focused(true)
        .disable_drag_drop_handler()
        .build()
        .map_err(|e| e.to_string())?;
    let handle = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::Focused(false) = event {
            let _ = handle.hide();
        }
    });
    let _ = window.set_focus();
    Ok(())
}

/// Webview açılışta mevcut kipi sorar.
#[tauri::command]
pub fn quick_mode() -> String {
    (*MODE.lock().unwrap_or_else(|e| e.into_inner())).to_string()
}

#[tauri::command]
pub fn quick_hide<R: Runtime>(app: AppHandle<R>) {
    if let Some(window) = app.get_webview_window(QUICK_LABEL) {
        let _ = window.hide();
    }
}

/// Ana pencereyi gösterir ve hızlı pencereyi gizler (panel/not açma sonuçları için).
#[tauri::command]
pub fn quick_open_main<R: Runtime>(app: AppHandle<R>) {
    quick_hide(app.clone());
    crate::windows::show_main(&app);
}
