//! Uygulama içi tarayıcı: pencerenin içine yerleştirilen alt webview'ler (WebView2 = Chromium motoru).
//!
//! - Her sekme ayrı bir alt webview'dir; etiketi `<pencere>-browser-<sekme>`. Sekme kimliğini TS üretir
//!   (`[a-z0-9-]{1,24}`), burada doğrulanır.
//! - Konumu/boyutu React tarafındaki bölme alanına göre `browser_set_bounds` ile güncellenir; görünmeyen
//!   sekmeler gizlenir (kapatılmaz, oturum ve sayfa durumu korunur).
//! - `target=_blank` / `window.open` istekleri yerel açılır pencere yerine `newTab` olayıyla TS'e bildirilir.
//! - Uzak sayfalar uygulama komutlarına erişemez (capability'lerde `remote` adres tanımlı değil).
//! - Profil (çerezler, oturumlar) `%LOCALAPPDATA%\com.alperen.alpicim\browser` altında kalıcıdır.
//! - Windows'ta webview oluşturmak senkron komutta kilitlenir; bu yüzden komutlar async'tir.

use serde::Serialize;
use tauri::{
    webview::{NewWindowResponse, PageLoadEvent, WebviewBuilder},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Runtime, Url, Webview, WebviewUrl, Window,
};

pub const BROWSER_EVENT: &str = "alpicim://browser";

/// Bir pencerede açık tutulabilecek en fazla sekme (TS tarafı da sınırlar; bu yalnız güvenlik ağı).
const MAX_TABS_PER_WINDOW: usize = 16;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BrowserEvent {
    owner: String,
    tab: String,
    /// "state" (adres/başlık/yükleniyor) | "newTab" (sayfa yeni sekme istedi; `url` açılacak adres)
    kind: &'static str,
    url: Option<String>,
    title: Option<String>,
    loading: Option<bool>,
}

impl BrowserEvent {
    fn state(owner: &str, tab: &str) -> Self {
        Self { owner: owner.to_string(), tab: tab.to_string(), kind: "state", url: None, title: None, loading: None }
    }
}

/// Sekme kimliği: 1–24 karakter, yalnız küçük harf, rakam ve tire.
pub fn valid_tab_id(tab: &str) -> bool {
    !tab.is_empty() && tab.len() <= 24 && tab.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

fn label_prefix(window: &str) -> String {
    format!("{window}-browser-")
}

pub fn label_for(window: &str, tab: &str) -> Result<String, String> {
    if !valid_tab_id(tab) {
        return Err("Geçersiz sekme kimliği".into());
    }
    Ok(format!("{}{tab}", label_prefix(window)))
}

pub fn parse_web_url(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw.trim()).map_err(|_| "Geçersiz adres".to_string())?;
    match url.scheme() {
        "http" | "https" => Ok(url),
        other => Err(format!("Bu adres türü açılamaz: {other}")),
    }
}

fn is_web(u: &Url) -> bool {
    matches!(u.scheme(), "http" | "https")
}

fn emit<R: Runtime>(app: &AppHandle<R>, event: BrowserEvent) {
    let _ = app.emit(BROWSER_EVENT, event);
}

fn tab_webview<R: Runtime>(app: &AppHandle<R>, window: &Window<R>, tab: &str) -> Result<Webview<R>, String> {
    app.get_webview(&label_for(window.label(), tab)?).ok_or_else(|| "Sekme açık değil".to_string())
}

/// Bu pencereye ait tarayıcı webview'leri.
fn owned_webviews<R: Runtime>(app: &AppHandle<R>, window: &str) -> Vec<Webview<R>> {
    let prefix = label_prefix(window);
    app.webviews().into_iter().filter(|(label, _)| label.starts_with(&prefix)).map(|(_, wv)| wv).collect()
}

/// Sekmeyi oluşturur ya da var olanı verilen konuma taşıyıp gösterir.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn browser_open<R: Runtime>(
    app: AppHandle<R>,
    window: Window<R>,
    tab: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let owner = window.label().to_string();
    let label = label_for(&owner, &tab)?;
    let (w, h) = (width.max(1.0), height.max(1.0));

    if let Some(existing) = app.get_webview(&label) {
        existing.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
        existing.set_size(LogicalSize::new(w, h)).map_err(|e| e.to_string())?;
        existing.show().map_err(|e| e.to_string())?;
        return Ok(());
    }
    if owned_webviews(&app, &owner).len() >= MAX_TABS_PER_WINDOW {
        return Err("Çok fazla sekme açık".into());
    }

    let start = parse_web_url(&url)?;
    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("browser");

    let (nav_app, nav_owner, nav_tab) = (app.clone(), owner.clone(), tab.clone());
    let (load_app, load_owner, load_tab) = (app.clone(), owner.clone(), tab.clone());
    let (title_app, title_owner, title_tab) = (app.clone(), owner.clone(), tab.clone());
    let (popup_app, popup_owner, popup_tab) = (app.clone(), owner.clone(), tab.clone());

    let builder = WebviewBuilder::new(&label, WebviewUrl::External(start))
        .data_directory(data_dir)
        .on_navigation(move |u| {
            // Yalnızca web adreslerine izin ver (file://, javascript: vb. engellenir).
            let ok = matches!(u.scheme(), "http" | "https" | "about" | "blob" | "data");
            if ok && is_web(u) {
                emit(
                    &nav_app,
                    BrowserEvent { url: Some(u.to_string()), loading: Some(true), ..BrowserEvent::state(&nav_owner, &nav_tab) },
                );
            }
            ok
        })
        .on_page_load(move |_webview, payload| {
            let loading = matches!(payload.event(), PageLoadEvent::Started);
            emit(
                &load_app,
                BrowserEvent {
                    url: Some(payload.url().to_string()),
                    loading: Some(loading),
                    ..BrowserEvent::state(&load_owner, &load_tab)
                },
            );
        })
        .on_document_title_changed(move |_webview, title| {
            emit(&title_app, BrowserEvent { title: Some(title), ..BrowserEvent::state(&title_owner, &title_tab) });
        })
        .on_new_window(move |u, _features| {
            // Yeni pencere istekleri uygulama içinde yeni sekme olarak açılır; yerel açılır pencere reddedilir.
            if is_web(&u) {
                emit(
                    &popup_app,
                    BrowserEvent { kind: "newTab", url: Some(u.to_string()), ..BrowserEvent::state(&popup_owner, &popup_tab) },
                );
            }
            NewWindowResponse::Deny
        });

    let webview = window
        .add_child(builder, LogicalPosition::new(x, y), LogicalSize::new(w, h))
        .map_err(|e| format!("Tarayıcı açılamadı: {e}"))?;
    crate::adblock::attach(&app, &webview);
    Ok(())
}

/// Konum/boyut günceller; `visible` false ise gizler (etkin olmayan sekme, menüler, sürükleme sırasında).
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn browser_set_bounds<R: Runtime>(
    app: AppHandle<R>,
    window: Window<R>,
    tab: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    visible: bool,
) -> Result<(), String> {
    let Some(wv) = app.get_webview(&label_for(window.label(), &tab)?) else {
        return Ok(());
    };
    if !visible || width < 2.0 || height < 2.0 {
        return wv.hide().map_err(|e| e.to_string());
    }
    wv.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
    wv.set_size(LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
    wv.show().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browser_navigate<R: Runtime>(
    app: AppHandle<R>,
    window: Window<R>,
    tab: String,
    url: String,
) -> Result<(), String> {
    let wv = tab_webview(&app, &window, &tab)?;
    wv.navigate(parse_web_url(&url)?).map_err(|e| e.to_string())
}

/// "back" | "forward" | "reload" | "stop"
#[tauri::command]
pub async fn browser_action<R: Runtime>(
    app: AppHandle<R>,
    window: Window<R>,
    tab: String,
    action: String,
) -> Result<(), String> {
    let wv = tab_webview(&app, &window, &tab)?;
    match action.as_str() {
        "back" => wv.eval("history.back()"),
        "forward" => wv.eval("history.forward()"),
        "reload" => wv.reload(),
        "stop" => wv.eval("window.stop()"),
        _ => return Err("Bilinmeyen işlem".into()),
    }
    .map_err(|e| e.to_string())
}

/// Tek sekmeyi kapatır (yoksa sessizce başarılı).
#[tauri::command]
pub async fn browser_close<R: Runtime>(app: AppHandle<R>, window: Window<R>, tab: String) -> Result<(), String> {
    if let Some(wv) = app.get_webview(&label_for(window.label(), &tab)?) {
        wv.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Bu penceredeki tüm tarayıcı sekmelerini kapatır (panel kaldırılınca).
#[tauri::command]
pub async fn browser_close_all<R: Runtime>(app: AppHandle<R>, window: Window<R>) -> Result<(), String> {
    for wv in owned_webviews(&app, window.label()) {
        let _ = wv.close();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_web_urls_are_allowed() {
        assert!(parse_web_url("https://www.google.com").is_ok());
        assert!(parse_web_url("http://example.com/a?b=c").is_ok());
        assert!(parse_web_url("file:///C:/Windows/win.ini").is_err());
        assert!(parse_web_url("javascript:alert(1)").is_err());
        assert!(parse_web_url("tauri://localhost").is_err());
    }

    #[test]
    fn tab_ids_are_validated() {
        assert!(valid_tab_id("t1"));
        assert!(valid_tab_id("k9x2-ab"));
        assert!(valid_tab_id(&"a".repeat(24)));
        assert!(!valid_tab_id(""));
        assert!(!valid_tab_id(&"a".repeat(25)));
        assert!(!valid_tab_id("T1"));
        assert!(!valid_tab_id("a_b"));
        assert!(!valid_tab_id("../x"));
        assert!(!valid_tab_id("a b"));
        assert!(!valid_tab_id("ş"));
    }

    #[test]
    fn labels_are_scoped_to_window() {
        assert_eq!(label_for("main", "t1").unwrap(), "main-browser-t1");
        assert_eq!(label_for("panel-browser", "x-2").unwrap(), "panel-browser-browser-x-2");
        assert!(label_for("main", "bad id").is_err());
        assert!(label_for("main", "t1").unwrap().starts_with(&label_prefix("main")));
        // Başka pencerenin öneki eşleşmez.
        assert!(!label_for("main", "t1").unwrap().starts_with(&label_prefix("panel-browser")));
    }
}
