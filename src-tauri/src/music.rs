//! YouTube Music paneli: resmî web arayüzü (https://music.youtube.com/) için tek, uygulama genelinde bir alt webview.
//!
//! - Uygulama genelinde tek örnek (`music` etiketi). Panel başka bir pencereye taşınınca webview
//!   `reparent` ile taşınır; çalma kesilmez.
//! - Profil, tarayıcı paneliyle aynıdır (`%LOCALAPPDATA%\com.alperen.alpicim\browser`): Google oturumu bir kez açılır.
//! - Reklam engelleyici (`adblock.rs`) oluşturulunca bağlanır; onun dışında sayfaya betik enjekte edilmez. Oynatma denetimi Windows medya oturumu (SMTC, `system.rs`) üzerinden,
//!   sessize alma WebView2'nin resmî `IsMuted` özelliğiyle yapılır.
//! - YouTube/Google dışındaki bağlantılar sistem tarayıcısında açılır.

use serde::Serialize;
use tauri::{
    webview::{NewWindowResponse, PageLoadEvent, WebviewBuilder},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Runtime, Url, WebviewUrl, Window,
};
use tauri_plugin_opener::OpenerExt;

pub const MUSIC_LABEL: &str = "music";
pub const MUSIC_EVENT: &str = "alpicim://music";
pub const MUSIC_HOME: &str = "https://music.youtube.com/";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MusicState {
    url: Option<String>,
    title: Option<String>,
    loading: Option<bool>,
}

/// Webview'de kalması gereken alan adları (oturum açma akışı dahil).
pub fn stays_inside(url: &Url) -> bool {
    let host = url.host_str().unwrap_or("").to_ascii_lowercase();
    let allowed = ["youtube.com", "google.com", "google.com.tr", "gstatic.com", "googleusercontent.com", "youtube-nocookie.com"];
    allowed.iter().any(|d| host == *d || host.ends_with(&format!(".{d}")))
}

fn emit<R: Runtime>(app: &AppHandle<R>, state: MusicState) {
    let _ = app.emit(MUSIC_EVENT, state);
}

#[tauri::command]
pub async fn music_open<R: Runtime>(
    app: AppHandle<R>,
    window: Window<R>,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let (w, h) = (width.max(1.0), height.max(1.0));
    if let Some(existing) = app.get_webview(MUSIC_LABEL) {
        if existing.window().label() != window.label() {
            existing.reparent(&window).map_err(|e| format!("Müzik paneli taşınamadı: {e}"))?;
        }
        existing.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
        existing.set_size(LogicalSize::new(w, h)).map_err(|e| e.to_string())?;
        existing.show().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let start = Url::parse(MUSIC_HOME).map_err(|e| e.to_string())?;
    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("browser");
    let nav_app = app.clone();
    let load_app = app.clone();
    let title_app = app.clone();
    let popup_app = app.clone();

    let builder = WebviewBuilder::new(MUSIC_LABEL, WebviewUrl::External(start))
        .data_directory(data_dir)
        .on_navigation(move |u| {
            match u.scheme() {
                "http" | "https" => {}
                "about" | "blob" | "data" => return true,
                _ => return false,
            }
            if stays_inside(u) {
                emit(&nav_app, MusicState { url: Some(u.to_string()), title: None, loading: Some(true) });
                true
            } else {
                // Dış bağlantı: sistem tarayıcısında aç, müzik panelinden ayrılma.
                let _ = nav_app.opener().open_url(u.as_str(), None::<&str>);
                false
            }
        })
        .on_page_load(move |_wv, payload| {
            let loading = matches!(payload.event(), PageLoadEvent::Started);
            emit(&load_app, MusicState { url: Some(payload.url().to_string()), title: None, loading: Some(loading) });
        })
        .on_document_title_changed(move |_wv, title| {
            emit(&title_app, MusicState { url: None, title: Some(title), loading: None });
        })
        .on_new_window(move |u, _features| {
            if matches!(u.scheme(), "http" | "https") {
                if stays_inside(&u) {
                    if let Some(wv) = popup_app.get_webview(MUSIC_LABEL) {
                        let _ = wv.navigate(u);
                    }
                } else {
                    let _ = popup_app.opener().open_url(u.as_str(), None::<&str>);
                }
            }
            NewWindowResponse::Deny
        });

    let webview = window
        .add_child(builder, LogicalPosition::new(x, y), LogicalSize::new(w, h))
        .map_err(|e| format!("YouTube Music açılamadı: {e}"))?;
    crate::adblock::attach(&app, &webview);
    Ok(())
}

/// Konum/boyut; `visible` false → gizle (çalma devam eder).
#[tauri::command]
pub async fn music_set_bounds<R: Runtime>(
    app: AppHandle<R>,
    window: Window<R>,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    visible: bool,
) -> Result<(), String> {
    let Some(wv) = app.get_webview(MUSIC_LABEL) else { return Ok(()) };
    // Başka bir penceredeki panel bu webview'i yönetmez.
    if wv.window().label() != window.label() {
        return Ok(());
    }
    if !visible || width < 2.0 || height < 2.0 {
        return wv.hide().map_err(|e| e.to_string());
    }
    wv.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
    wv.set_size(LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
    wv.show().map_err(|e| e.to_string())
}

/// Panel kapanırken: `keep_playing` ise yalnızca gizlenir, değilse webview kapatılır (ses durur).
#[tauri::command]
pub async fn music_release<R: Runtime>(app: AppHandle<R>, window: Window<R>, keep_playing: bool) -> Result<(), String> {
    let Some(wv) = app.get_webview(MUSIC_LABEL) else { return Ok(()) };
    if wv.window().label() != window.label() {
        return Ok(());
    }
    if keep_playing {
        wv.hide().map_err(|e| e.to_string())
    } else {
        wv.close().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn music_close<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    if let Some(wv) = app.get_webview(MUSIC_LABEL) {
        wv.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn music_is_open<R: Runtime>(app: AppHandle<R>) -> bool {
    app.get_webview(MUSIC_LABEL).is_some()
}

/// "home" | "back" | "reload"
#[tauri::command]
pub async fn music_action<R: Runtime>(app: AppHandle<R>, action: String) -> Result<(), String> {
    let wv = app.get_webview(MUSIC_LABEL).ok_or("YouTube Music açık değil")?;
    match action.as_str() {
        "home" => wv.navigate(Url::parse(MUSIC_HOME).map_err(|e| e.to_string())?),
        "back" => wv.eval("history.back()"),
        "reload" => wv.reload(),
        _ => return Err("Bilinmeyen işlem".into()),
    }
    .map_err(|e| e.to_string())
}

/// Resmî arama sayfasının adresi (yalnızca music.youtube.com).
pub fn search_url(query: &str) -> Result<Url, String> {
    let q = query.trim();
    if q.is_empty() || q.chars().count() > 200 {
        return Err("Arama metni 1–200 karakter olmalı".into());
    }
    Url::parse_with_params("https://music.youtube.com/search", &[("q", q)]).map_err(|e| e.to_string())
}

/// Mini oynatıcı araması: müzik webview'ini resmî arama sayfasına götürür (gerekirse gizli olarak oluşturur).
#[tauri::command]
pub async fn music_search<R: Runtime>(app: AppHandle<R>, window: Window<R>, query: String) -> Result<(), String> {
    let url = search_url(&query)?;
    if app.get_webview(MUSIC_LABEL).is_none() {
        // Panel açık değilse webview gizli olarak oluşturulur; sonuçlar genişletilmiş oynatıcıda gösterilir.
        music_open(app.clone(), window.clone(), 0.0, 0.0, 1.0, 1.0).await?;
        if let Some(wv) = app.get_webview(MUSIC_LABEL) {
            let _ = wv.hide();
        }
    }
    let wv = app.get_webview(MUSIC_LABEL).ok_or("YouTube Music açılamadı")?;
    wv.navigate(url).map_err(|e| e.to_string())
}

/// Ses düzeyi betiği: YouTube Music sayfasındaki <video> öğesinin `volume` özelliği (0..1).
pub fn volume_script(volume: f64) -> String {
    let v = if volume.is_finite() { volume.clamp(0.0, 1.0) } else { 1.0 };
    format!("document.querySelectorAll('video').forEach(function(e){{e.volume={v:.3};}});")
}

/// Çalan videonun ses düzeyini ayarlar (0..1); sessize alma ayrıdır.
#[tauri::command]
pub async fn music_set_volume<R: Runtime>(app: AppHandle<R>, volume: f64) -> Result<(), String> {
    let wv = app.get_webview(MUSIC_LABEL).ok_or("YouTube Music açık değil")?;
    wv.eval(volume_script(volume)).map_err(|e| e.to_string())
}

/// WebView2'nin resmî sessize alma özelliği (ICoreWebView2_8::IsMuted).
#[tauri::command]
pub async fn music_set_muted<R: Runtime>(app: AppHandle<R>, muted: bool) -> Result<(), String> {
    let wv = app.get_webview(MUSIC_LABEL).ok_or("YouTube Music açık değil")?;
    #[cfg(windows)]
    {
        let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
        wv.with_webview(move |platform| {
            use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_8;
            use windows::core::Interface;
            let result = unsafe {
                platform
                    .controller()
                    .CoreWebView2()
                    .and_then(|core| core.cast::<ICoreWebView2_8>())
                    .and_then(|core8| core8.SetIsMuted(muted))
            };
            let _ = tx.send(result.map_err(|e| format!("Ses durumu değiştirilemedi: {e}")));
        })
        .map_err(|e| e.to_string())?;
        tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(std::time::Duration::from_secs(3)))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|_| "WebView2 yanıt vermedi".to_string())?
    }
    #[cfg(not(windows))]
    {
        let _ = (wv, muted);
        Err("Yalnızca Windows'ta desteklenir".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_search_url_safely() {
        let u = search_url("  Sezen Aksu & Tarkan ").unwrap();
        assert_eq!(u.host_str(), Some("music.youtube.com"));
        assert_eq!(u.path(), "/search");
        assert_eq!(u.query_pairs().next().map(|(_, v)| v.into_owned()), Some("Sezen Aksu & Tarkan".into()));
        assert!(search_url("   ").is_err());
    }

    #[test]
    fn volume_script_clamps() {
        assert!(volume_script(2.0).contains("volume=1.000"));
        assert!(volume_script(-1.0).contains("volume=0.000"));
        assert!(volume_script(f64::NAN).contains("volume=1.000"));
        assert!(volume_script(0.5).contains("volume=0.500"));
    }

    #[test]
    fn keeps_google_and_youtube_inside() {
        for u in [
            "https://music.youtube.com/watch?v=x",
            "https://accounts.google.com/signin",
            "https://www.youtube.com/",
            "https://consent.youtube.com/m",
            "https://accounts.google.com.tr/",
        ] {
            assert!(stays_inside(&Url::parse(u).unwrap()), "{u}");
        }
        for u in ["https://example.com/", "https://evilyoutube.com/", "https://youtube.com.evil.net/", "https://accounts.google.evil.com/"] {
            assert!(!stays_inside(&Url::parse(u).unwrap()), "{u}");
        }
    }
}
