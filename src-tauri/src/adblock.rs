//! Reklam engelleyici: uygulama içi tarayıcı sekmeleri ve YouTube Music webview'i için.
//!
//! - Motor: Brave'in `adblock` crate'i (uBlock Origin / AdGuard / EasyList sözdizimi). `single-thread` özelliği
//!   kapalı olduğu için `Engine: Send + Sync`; küresel `RwLock<Option<Arc<Engine>>>` içinde tutulur, arka planda
//!   yeniden kurulup tek hamlede değiştirilir.
//! - Ağ engelleme: WebView2 `WebResourceRequested` ("*" süzgeci). Eşleşen istek 403 boş yanıtla kesilir.
//!   Üst düzey belge istekleri hiç engellenmez (sayfa açılmaz hâle gelmesin).
//! - Görünüm (cosmetic) süzme: sayfa yüklenirken alan adına özgü + genel seçiciler `<style>` olarak eklenir; sayfadaki
//!   sınıf/kimlikler toplanıp genel `##.sınıf` kuralları da uygulanır (DOMContentLoaded ve yükleme sonunda iki tur).
//! - YouTube: oynatıcı yanıtlarından reklam alanları budanır (uBO `json-prune` eşdeğeri) ve görünen reklamlar atlanır.
//! - Listeler Rust tarafında indirilir (`%LOCALAPPDATA%\com.alperen.alpicim\adblock\<id>.txt`), 4 günden eskiyse
//!   arka planda yenilenir. Durum (açık/kapalı, izin listesi) `%APPDATA%\com.alperen.alpicim\adblock.json`.
//! - Olay: `alpicim://adblock` `{label, blocked}`; webview başına en sık 250 ms'de bir, yeni sayfada sıfırlanır.

use std::{
    collections::{HashMap, HashSet},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering},
        Arc, LazyLock, Mutex, MutexGuard, OnceLock, RwLock,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use adblock::{
    lists::{FilterSet, ParseOptions},
    request::Request,
    Engine,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime};

pub const ADBLOCK_EVENT: &str = "alpicim://adblock";
const REFRESH_AFTER: Duration = Duration::from_secs(4 * 24 * 60 * 60);
const RECHECK_EVERY: Duration = Duration::from_secs(6 * 60 * 60);
const EMIT_EVERY: Duration = Duration::from_millis(250);
const MAX_LIST_BYTES: usize = 24 * 1024 * 1024;
const MAX_ALLOWLIST: usize = 500;

struct ListDef {
    id: &'static str,
    title: &'static str,
    url: &'static str,
}

/// uBlock biçimli listeler (adblock-rust en iyi bu sözdizimini anlar).
const LISTS: &[ListDef] = &[
    ListDef { id: "adguard-base", title: "AdGuard Temel", url: "https://filters.adtidy.org/extension/ublock/filters/2.txt" },
    ListDef { id: "adguard-turkish", title: "AdGuard Türkçe", url: "https://filters.adtidy.org/extension/ublock/filters/13.txt" },
    ListDef { id: "easyprivacy", title: "EasyPrivacy", url: "https://easylist.to/easylist/easyprivacy.txt" },
    ListDef { id: "ublock-filters", title: "uBlock Origin filtreleri", url: "https://ublockorigin.github.io/uAssets/filters/filters.txt" },
];

// ---------------------------------------------------------------------------------------------------------------
// Sözleşme (src/modules/browser/adblockService.ts)
// ---------------------------------------------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdblockList {
    pub id: String,
    pub title: String,
    pub url: String,
    pub updated_at: Option<u64>,
    pub rules: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdblockStatus {
    pub enabled: bool,
    pub ready: bool,
    pub rules: u32,
    pub lists: Vec<AdblockList>,
    pub blocked_total: u64,
    pub allowlist: Vec<String>,
    pub error: Option<String>,
    /// Listeler şu an indiriliyor / motor kuruluyor mu?
    pub updating: bool,
}

#[derive(Clone, Serialize)]
struct BlockedEvent {
    label: String,
    blocked: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct Config {
    enabled: bool,
    allowlist: Vec<String>,
}

impl Default for Config {
    fn default() -> Self {
        Self { enabled: true, allowlist: Vec::new() }
    }
}

impl Config {
    fn sanitized(self) -> Self {
        let mut seen = HashSet::new();
        let mut allowlist: Vec<String> = self
            .allowlist
            .iter()
            .filter_map(|h| normalize_host(h))
            .filter(|h| seen.insert(h.clone()))
            .collect();
        allowlist.sort();
        allowlist.truncate(MAX_ALLOWLIST);
        Self { enabled: self.enabled, allowlist }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Küresel durum
// ---------------------------------------------------------------------------------------------------------------

struct Cosmetic {
    url: String,
    css: String,
    exceptions: HashSet<String>,
    generichide: bool,
}

/// Tek bir webview'in durumu. Olay işleyicileri UI iş parçacığında çalışır; kilitler kısa tutulur.
struct ViewState {
    label: String,
    /// ICoreWebView2 işaretçisi: aynı etiketle yeniden oluşturulan webview'i ayırt etmek için.
    #[cfg_attr(not(windows), allow(dead_code))]
    ptr: usize,
    page_url: Mutex<String>,
    nav_url: Mutex<String>,
    /// Engelleme bu sayfada etkin mi (açık ve izin listesinde değil)?
    active: AtomicBool,
    blocked: AtomicU32,
    dirty: AtomicBool,
    cosmetic: Mutex<Option<Cosmetic>>,
    applied_generic: Mutex<HashSet<String>>,
    #[cfg_attr(not(windows), allow(dead_code))]
    script_ids: Mutex<Vec<String>>,
}

impl ViewState {
    fn new(label: &str, ptr: usize) -> Self {
        Self {
            label: label.to_string(),
            ptr,
            page_url: Mutex::new(String::new()),
            nav_url: Mutex::new(String::new()),
            active: AtomicBool::new(lock_read(&shared().config).enabled),
            blocked: AtomicU32::new(0),
            dirty: AtomicBool::new(false),
            cosmetic: Mutex::new(None),
            applied_generic: Mutex::new(HashSet::new()),
            script_ids: Mutex::new(Vec::new()),
        }
    }

    fn refresh_active(&self) {
        let url = lock(&self.page_url).clone();
        let cfg = lock_read(&shared().config);
        self.active.store(page_active(&url, &cfg), Ordering::Relaxed);
    }

    /// Yeni üst düzey gezinme: sayaç sıfırlanır.
    #[cfg_attr(not(windows), allow(dead_code))]
    fn on_navigation(&self, url: &str) {
        *lock(&self.nav_url) = url.to_string();
        *lock(&self.page_url) = url.to_string();
        *lock(&self.cosmetic) = None;
        lock(&self.applied_generic).clear();
        self.blocked.store(0, Ordering::Relaxed);
        self.dirty.store(true, Ordering::Relaxed);
        self.refresh_active();
    }
}

struct Shared {
    engine: RwLock<Option<Arc<Engine>>>,
    config: RwLock<Config>,
    counts: Mutex<HashMap<String, u32>>,
    error: Mutex<Option<String>>,
    blocked_total: AtomicU64,
    updating: AtomicBool,
    config_path: OnceLock<PathBuf>,
    cache_dir: OnceLock<PathBuf>,
    views: Mutex<HashMap<String, Arc<ViewState>>>,
}

fn shared() -> &'static Shared {
    static SHARED: LazyLock<Shared> = LazyLock::new(|| Shared {
        engine: RwLock::new(None),
        config: RwLock::new(Config::default()),
        counts: Mutex::new(HashMap::new()),
        error: Mutex::new(None),
        blocked_total: AtomicU64::new(0),
        updating: AtomicBool::new(false),
        config_path: OnceLock::new(),
        cache_dir: OnceLock::new(),
        views: Mutex::new(HashMap::new()),
    });
    &SHARED
}

static UPDATE_LOCK: LazyLock<tauri::async_runtime::Mutex<()>> = LazyLock::new(|| tauri::async_runtime::Mutex::new(()));

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

fn lock_read<T>(m: &RwLock<T>) -> std::sync::RwLockReadGuard<'_, T> {
    m.read().unwrap_or_else(|e| e.into_inner())
}

fn lock_write<T>(m: &RwLock<T>) -> std::sync::RwLockWriteGuard<'_, T> {
    m.write().unwrap_or_else(|e| e.into_inner())
}

#[cfg_attr(not(windows), allow(dead_code))]
fn current_engine() -> Option<Arc<Engine>> {
    lock_read(&shared().engine).clone()
}

// ---------------------------------------------------------------------------------------------------------------
// Saf yardımcılar (birim testli)
// ---------------------------------------------------------------------------------------------------------------

/// Kullanıcı girdisini ("https://www.Örnek.com/yol", "www.site.com.tr") alan adına çevirir: küçük harf, punycode,
/// `www.` öneki olmadan. Geçersizse None.
pub fn normalize_host(input: &str) -> Option<String> {
    let raw = input.trim();
    if raw.is_empty() || raw.len() > 300 {
        return None;
    }
    let candidate = if raw.contains("://") { raw.to_string() } else { format!("http://{raw}") };
    let url = url::Url::parse(&candidate).ok()?;
    if !matches!(url.scheme(), "http" | "https") {
        return None;
    }
    let host = url.host_str()?.trim_end_matches('.').to_ascii_lowercase();
    let host = host.strip_prefix("www.").unwrap_or(&host).to_string();
    let valid = !host.is_empty()
        && host.len() <= 253
        && (host.contains('.') || host == "localhost")
        && host.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '[' | ']' | ':'));
    valid.then_some(host)
}

/// Sayfa adresinin alan adı izin listesindeki bir alan adına (veya alt alan adına) mı ait?
pub fn is_allowlisted(page_url: &str, allowlist: &[String]) -> bool {
    let Some(host) = url::Url::parse(page_url).ok().and_then(|u| u.host_str().map(str::to_ascii_lowercase)) else {
        return false;
    };
    let host = host.strip_prefix("www.").unwrap_or(&host);
    allowlist.iter().any(|d| host == d || host.ends_with(&format!(".{d}")))
}

fn page_active(page_url: &str, cfg: &Config) -> bool {
    cfg.enabled && !is_allowlisted(page_url, &cfg.allowlist)
}

/// WebView2 `COREWEBVIEW2_WEB_RESOURCE_CONTEXT` değeri → adblock istek türü.
/// Belge (1) burada yalnızca alt çerçeve olabilir; üst düzey belge `decide` içinde ayrılır.
pub fn resource_type(context: i32) -> &'static str {
    match context {
        1 => "sub_frame",
        2 => "stylesheet",
        3 => "image",
        4 => "media",
        5 => "font",
        6 => "script",
        7 | 8 | 10 => "xmlhttprequest", // XHR, fetch, EventSource
        11 => "websocket",
        14 => "ping",
        15 => "csp_report",
        _ => "other",
    }
}

/// İstek engellensin mi? `main_document`: üst düzey gezinmenin kendisi (asla engellenmez).
pub fn decide(engine: &Engine, url: &str, source_url: &str, context: i32, main_document: bool) -> bool {
    if main_document {
        return false;
    }
    let lower = url.get(..6).unwrap_or(url).to_ascii_lowercase();
    if !(lower.starts_with("http:") || lower.starts_with("https:") || lower.starts_with("ws:") || lower.starts_with("wss:")) {
        return false;
    }
    let source = if source_url.starts_with("http") { source_url } else { "" };
    match Request::new(url, source, resource_type(context), "") {
        Ok(request) => engine.check_network_request(&request).should_block(),
        Err(_) => false,
    }
}

/// Kural sayısı (yorum ve başlık satırları hariç).
pub fn count_rules(text: &str) -> u32 {
    let n = text
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with('!') && !l.starts_with('[') && !l.starts_with("# "))
        .count();
    u32::try_from(n).unwrap_or(u32::MAX)
}

/// Seçicileri ayrı kurallara böler: geçersiz bir seçici tüm grubu düşürmesin. CSS kaçışı içeren seçiciler atlanır.
pub fn build_css<'a>(selectors: impl IntoIterator<Item = &'a String>) -> String {
    let mut css = String::new();
    for s in selectors {
        let s = s.trim();
        if s.is_empty() || s.contains('{') || s.contains('}') || s.contains("</") || s.len() > 2000 {
            continue;
        }
        css.push_str(s);
        css.push_str("{display:none!important}\n");
    }
    css
}

fn build_engine(texts: &[(String, String)]) -> Engine {
    let mut set = FilterSet::new(false);
    for (_, text) in texts {
        set.add_filter_list(text.clone(), ParseOptions::default());
    }
    Engine::new_with_filter_set(set)
}

// ---------------------------------------------------------------------------------------------------------------
// Durum, yapılandırma, listeler
// ---------------------------------------------------------------------------------------------------------------

fn list_path(id: &str) -> Option<PathBuf> {
    shared().cache_dir.get().map(|d| d.join(format!("{id}.txt")))
}

fn list_mtime(id: &str) -> Option<SystemTime> {
    std::fs::metadata(list_path(id)?).and_then(|m| m.modified()).ok()
}

fn is_stale(id: &str) -> bool {
    match list_mtime(id) {
        Some(t) => SystemTime::now().duration_since(t).map(|age| age > REFRESH_AFTER).unwrap_or(false),
        None => true,
    }
}

pub fn status() -> AdblockStatus {
    let s = shared();
    let cfg = lock_read(&s.config).clone();
    let counts = lock(&s.counts).clone();
    let lists: Vec<AdblockList> = LISTS
        .iter()
        .map(|l| AdblockList {
            id: l.id.into(),
            title: l.title.into(),
            url: l.url.into(),
            updated_at: list_mtime(l.id)
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64),
            rules: counts.get(l.id).copied().unwrap_or(0),
        })
        .collect();
    AdblockStatus {
        enabled: cfg.enabled,
        ready: lock_read(&s.engine).is_some(),
        rules: lists.iter().map(|l| l.rules).sum(),
        lists,
        blocked_total: s.blocked_total.load(Ordering::Relaxed),
        allowlist: cfg.allowlist,
        error: lock(&s.error).clone(),
        updating: s.updating.load(Ordering::Relaxed),
    }
}

fn load_config(path: &PathBuf) -> Config {
    std::fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Config>(&bytes).ok())
        .map(Config::sanitized)
        .unwrap_or_default()
}

fn save_config(cfg: &Config) -> Result<(), String> {
    let path = shared().config_path.get().ok_or("Reklam engelleyici başlatılmadı")?;
    let data = serde_json::to_vec_pretty(cfg).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, data).map_err(|e| format!("Ayar yazılamadı: {e}"))?;
    std::fs::rename(&tmp, path).map_err(|e| format!("Ayar yazılamadı: {e}"))
}

fn read_cached_lists() -> Vec<(String, String)> {
    LISTS
        .iter()
        .filter_map(|l| {
            let text = std::fs::read_to_string(list_path(l.id)?).ok()?;
            (count_rules(&text) > 0).then(|| (l.id.to_string(), text))
        })
        .collect()
}

/// Önbellekteki listelerden motoru (arka planda) kurar ve devreye alır.
async fn rebuild_from_cache() -> Result<(), String> {
    let result = tauri::async_runtime::spawn_blocking(|| {
        let texts = read_cached_lists();
        if texts.is_empty() {
            return None;
        }
        let counts: HashMap<String, u32> = texts.iter().map(|(id, t)| (id.clone(), count_rules(t))).collect();
        Some((build_engine(&texts), counts))
    })
    .await
    .map_err(|e| format!("Filtre motoru kurulamadı: {e}"))?;
    if let Some((engine, counts)) = result {
        *lock_write(&shared().engine) = Some(Arc::new(engine));
        *lock(&shared().counts) = counts;
    }
    Ok(())
}

async fn download(client: &reqwest::Client, list: &ListDef) -> Result<(), String> {
    let path = list_path(list.id).ok_or("Önbellek klasörü yok")?;
    let resp = client.get(list.url).send().await.map_err(|e| format!("{}: {e}", list.title))?;
    if !resp.status().is_success() {
        return Err(format!("{}: HTTP {}", list.title, resp.status().as_u16()));
    }
    if resp.content_length().is_some_and(|n| n as usize > MAX_LIST_BYTES) {
        return Err(format!("{}: liste çok büyük", list.title));
    }
    let bytes = resp.bytes().await.map_err(|e| format!("{}: {e}", list.title))?;
    if bytes.len() > MAX_LIST_BYTES {
        return Err(format!("{}: liste çok büyük", list.title));
    }
    let text = String::from_utf8_lossy(&bytes).into_owned();
    if text.trim_start().starts_with('<') || count_rules(&text) < 10 {
        return Err(format!("{}: geçerli bir filtre listesi değil", list.title));
    }
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("txt.tmp");
    std::fs::write(&tmp, text.as_bytes()).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

/// Eksik/eski (veya `force` ile tüm) listeleri indirir, gerekirse motoru yeniden kurar. Aynı anda tek güncelleme.
async fn update(force: bool) {
    let _guard = UPDATE_LOCK.lock().await;
    let s = shared();
    s.updating.store(true, Ordering::Relaxed);

    if lock_read(&s.engine).is_none() {
        if let Err(e) = rebuild_from_cache().await {
            *lock(&s.error) = Some(e);
        }
    }

    let targets: Vec<&ListDef> = LISTS.iter().filter(|l| force || is_stale(l.id)).collect();
    if !targets.is_empty() {
        let mut errors = Vec::new();
        let mut changed = false;
        match reqwest::Client::builder()
            .user_agent(concat!("Alpicim/", env!("CARGO_PKG_VERSION"), " (filtre listesi guncelleme)"))
            .timeout(Duration::from_secs(90))
            .connect_timeout(Duration::from_secs(20))
            .redirect(reqwest::redirect::Policy::limited(5))
            .build()
        {
            Ok(client) => {
                for list in targets {
                    match download(&client, list).await {
                        Ok(()) => changed = true,
                        Err(e) => errors.push(e),
                    }
                }
            }
            Err(e) => errors.push(e.to_string()),
        }
        if changed {
            if let Err(e) = rebuild_from_cache().await {
                errors.push(e);
            }
        }
        *lock(&s.error) = if errors.is_empty() {
            None
        } else {
            Some(format!("Bazı listeler güncellenemedi: {}", errors.join("; ")))
        };
    }
    s.updating.store(false, Ordering::Relaxed);
}

/// Kurulum: yapılandırmayı okur, motoru önbellekten kurar ve listeleri arka planda yeniler (ana iş parçacığını
/// bekletmez). `setup` içinden bir kez çağrılır.
pub fn init<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let config_path = app.path().app_config_dir().map_err(|e| e.to_string())?.join("adblock.json");
    let cache_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("adblock");
    *lock_write(&shared().config) = load_config(&config_path);
    let _ = shared().config_path.set(config_path);
    let _ = shared().cache_dir.set(cache_dir);
    ensure_emitter(app);

    std::thread::Builder::new()
        .name("alpicim-adblock".into())
        .spawn(|| loop {
            tauri::async_runtime::block_on(update(false));
            std::thread::sleep(RECHECK_EVERY);
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Engellenen istek sayılarını webview başına en sık 250 ms'de bir yayınlar; kapanan webview'leri unutur.
fn ensure_emitter<R: Runtime>(app: &AppHandle<R>) {
    static STARTED: AtomicBool = AtomicBool::new(false);
    if STARTED.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    let spawned = std::thread::Builder::new().name("alpicim-adblock-events".into()).spawn(move || {
        let mut tick: u32 = 0;
        loop {
            std::thread::sleep(EMIT_EVERY);
            tick = tick.wrapping_add(1);
            let views: Vec<Arc<ViewState>> = lock(&shared().views).values().cloned().collect();
            for v in views {
                if v.dirty.swap(false, Ordering::Relaxed) {
                    let _ = app.emit(ADBLOCK_EVENT, BlockedEvent { label: v.label.clone(), blocked: v.blocked.load(Ordering::Relaxed) });
                }
            }
            if tick % 40 == 0 {
                lock(&shared().views).retain(|label, _| app.get_webview(label).is_some());
            }
        }
    });
    if spawned.is_err() {
        STARTED.store(false, Ordering::SeqCst);
    }
}

/// Ayar değişince: her webview'in etkinliğini yeniden hesaplar, YouTube betiğini ve görünüm stillerini günceller.
fn apply_config_to_views<R: Runtime>(app: &AppHandle<R>) {
    let views: Vec<Arc<ViewState>> = lock(&shared().views).values().cloned().collect();
    for view in views {
        view.refresh_active();
        #[cfg(windows)]
        {
            if let Some(wv) = app.get_webview(&view.label) {
                let v = view.clone();
                let _ = wv.with_webview(move |platform| {
                    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| unsafe {
                        if let Ok(core) = platform.controller().CoreWebView2() {
                            win::on_config_changed(&core, &v);
                        }
                    }));
                });
            }
        }
    }
    #[cfg(not(windows))]
    let _ = app;
}

// ---------------------------------------------------------------------------------------------------------------
// Webview'e bağlama
// ---------------------------------------------------------------------------------------------------------------

/// Bir webview'e reklam engelleyiciyi kurar (ağ süzgeci, görünüm süzme, YouTube betiği). Aynı webview için tekrar
/// çağrılırsa bir şey yapmaz; aynı etiketle yeni bir webview oluşturulduysa yeniden kurar.
pub fn attach<R: tauri::Runtime>(app: &tauri::AppHandle<R>, webview: &tauri::Webview<R>) {
    ensure_emitter(app);
    #[cfg(windows)]
    {
        let label = webview.label().to_string();
        let result = webview.with_webview(move |platform| {
            let installed = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| unsafe {
                win::install(&label, platform.controller())
            }));
            match installed {
                Ok(Err(e)) => eprintln!("Reklam engelleyici kurulamadı ({label}): {e}"),
                Err(_) => eprintln!("Reklam engelleyici kurulurken panik ({label})"),
                Ok(Ok(())) => {}
            }
        });
        if let Err(e) = result {
            eprintln!("Reklam engelleyici kurulamadı: {e}");
        }
    }
    #[cfg(not(windows))]
    let _ = webview;
}

#[cfg(windows)]
mod win {
    use std::{
        panic::{catch_unwind, AssertUnwindSafe},
        sync::{atomic::Ordering, Arc},
    };

    use serde::Deserialize;
    use webview2_com::{
        take_pwstr, AddScriptToExecuteOnDocumentCreatedCompletedHandler, ContentLoadingEventHandler,
        DOMContentLoadedEventHandler, ExecuteScriptCompletedHandler, Microsoft::Web::WebView2::Win32::*,
        NavigationCompletedEventHandler, NavigationStartingEventHandler, SourceChangedEventHandler,
        WebResourceRequestedEventHandler,
    };
    use windows::core::{Interface, BOOL, HSTRING, PWSTR};

    use super::*;

    const STYLE_ID: &str = "alpicim-ab-css";
    const GENERIC_STYLE_ID: &str = "alpicim-ab-gen";

    /// Sayfadaki sınıf ve kimlikleri toplar (genel `##.sınıf` / `###kimlik` kuralları için).
    const COLLECT_JS: &str = r#"(() => { const c = new Set(), i = new Set(); try { for (const e of document.querySelectorAll('[id],[class]')) { if (e.id) i.add(e.id); for (const k of e.classList) c.add(k); if (c.size + i.size > 8000) break; } } catch (_) {} return { c: [...c], i: [...i] }; })()"#;

    /// YouTube / YouTube Music: oynatıcı yanıtından reklam alanlarını budar, görünen reklamı atlar.
    const YOUTUBE_JS: &str = r#"(() => {
  const CFG = __CFG__;
  const host = location.hostname.replace(/^www\./, '');
  if (!/(^|\.)(youtube\.com|youtube-nocookie\.com)$/.test(host)) return;
  if (window.__alpicimYt) return;
  try { Object.defineProperty(window, '__alpicimYt', { value: true }); } catch (_) { return; }
  const allowed = CFG.allow.some((d) => host === d || host.endsWith('.' + d));
  if (typeof window.__alpicimAbOn !== 'boolean') window.__alpicimAbOn = CFG.enabled && !allowed;
  const on = () => window.__alpicimAbOn !== false;
  const KEYS = ['adPlacements', 'adSlots', 'playerAds', 'adBreakHeartbeatParams'];
  const strip = (o) => { if (o && typeof o === 'object') for (const k of KEYS) if (k in o) delete o[k]; };
  const prune = (o) => {
    try {
      if (on() && o && typeof o === 'object') {
        strip(o);
        if (o.playerResponse) strip(o.playerResponse);
        if (Array.isArray(o)) for (const x of o) if (x && x.playerResponse) strip(x.playerResponse);
      }
    } catch (_) {}
    return o;
  };
  const parse = JSON.parse;
  JSON.parse = function () { return prune(parse.apply(this, arguments)); };
  const json = Response.prototype.json;
  Response.prototype.json = function () { return json.apply(this, arguments).then(prune); };
  let initial;
  try {
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      configurable: true,
      get: () => initial,
      set: (v) => { initial = prune(v); },
    });
  } catch (_) {}
  const SKIP = '.ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-skip-ad-button,.ytp-ad-skip-button-slot button,.ytp-ad-overlay-close-button';
  setInterval(() => {
    if (!on()) return;
    try {
      const player = document.querySelector('.html5-video-player.ad-showing');
      if (player) {
        const v = player.querySelector('video');
        if (v && Number.isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration - 0.2) v.currentTime = v.duration;
      }
      for (const b of document.querySelectorAll(SKIP)) b.click();
    } catch (_) {}
  }, 250);
})();"#;

    #[derive(Deserialize)]
    struct Found {
        #[serde(default)]
        c: Vec<String>,
        #[serde(default)]
        i: Vec<String>,
    }

    /// COM olay işleyicisinde panik/hata asla WebView2'ye taşmasın.
    fn guarded(f: impl FnOnce() -> windows::core::Result<()>) -> windows::core::Result<()> {
        let _ = catch_unwind(AssertUnwindSafe(f));
        Ok(())
    }

    fn noop_handler() -> ICoreWebView2ExecuteScriptCompletedHandler {
        ExecuteScriptCompletedHandler::create(Box::new(|_, _| Ok(())))
    }

    unsafe fn exec(core: &ICoreWebView2, js: &str) {
        let _ = unsafe { core.ExecuteScript(&HSTRING::from(js), &noop_handler()) };
    }

    unsafe fn source_of(core: &ICoreWebView2) -> String {
        let mut p = PWSTR::null();
        if unsafe { core.Source(&mut p) }.is_ok() {
            take_pwstr(p)
        } else {
            String::new()
        }
    }

    fn style_js(id: &str, css: &str, append: bool) -> String {
        let css = serde_json::to_string(css).unwrap_or_else(|_| "\"\"".into());
        let op = if append { "+=" } else { "=" };
        format!(
            "(() => {{ try {{ let s = document.getElementById('{id}'); if (!s) {{ s = document.createElement('style'); s.id = '{id}'; (document.head || document.documentElement).appendChild(s); }} s.textContent {op} {css}; }} catch (_) {{}} }})()"
        )
    }

    fn youtube_js() -> String {
        let cfg = lock_read(&shared().config).clone();
        let json = serde_json::json!({ "enabled": cfg.enabled, "allow": cfg.allowlist });
        YOUTUBE_JS.replace("__CFG__", &json.to_string())
    }

    pub(super) unsafe fn install(label: &str, controller: ICoreWebView2Controller) -> windows::core::Result<()> {
        let core = unsafe { controller.CoreWebView2()? };
        let ptr = core.as_raw() as usize;
        let view = {
            let mut views = lock(&shared().views);
            if views.get(label).is_some_and(|v| v.ptr == ptr) {
                return Ok(());
            }
            let view = Arc::new(ViewState::new(label, ptr));
            views.insert(label.to_string(), view.clone());
            view
        };
        let initial = unsafe { source_of(&core) };
        *lock(&view.page_url) = initial.clone();
        *lock(&view.nav_url) = initial;
        view.refresh_active();

        let env = unsafe { core.cast::<ICoreWebView2_2>()?.Environment()? };
        let filter = HSTRING::from("*");
        unsafe {
            match core.cast::<ICoreWebView2_22>() {
                Ok(c22) => c22.AddWebResourceRequestedFilterWithRequestSourceKinds(
                    &filter,
                    COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
                    COREWEBVIEW2_WEB_RESOURCE_REQUEST_SOURCE_KINDS_ALL,
                )?,
                Err(_) => core.AddWebResourceRequestedFilter(&filter, COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL)?,
            }
        }

        let mut token = 0i64;

        // Ağ isteği süzgeci.
        let v = view.clone();
        let handler = WebResourceRequestedEventHandler::create(Box::new(move |_sender, args| {
            guarded(|| {
                let Some(args) = args else { return Ok(()) };
                if !v.active.load(Ordering::Relaxed) {
                    return Ok(());
                }
                let Some(engine) = current_engine() else { return Ok(()) };
                let request = unsafe { args.Request()? };
                let uri = {
                    let mut p = PWSTR::null();
                    unsafe { request.Uri(&mut p)? };
                    take_pwstr(p)
                };
                let mut ctx = COREWEBVIEW2_WEB_RESOURCE_CONTEXT(0);
                unsafe { args.ResourceContext(&mut ctx)? };
                let main_document = ctx == COREWEBVIEW2_WEB_RESOURCE_CONTEXT_DOCUMENT && *lock(&v.nav_url) == uri;
                let source = lock(&v.page_url).clone();
                if decide(&engine, &uri, &source, ctx.0, main_document) {
                    let response = unsafe { env.CreateWebResourceResponse(None, 403, &HSTRING::from("Blocked"), &HSTRING::new())? };
                    unsafe { args.SetResponse(&response)? };
                    v.blocked.fetch_add(1, Ordering::Relaxed);
                    v.dirty.store(true, Ordering::Relaxed);
                    shared().blocked_total.fetch_add(1, Ordering::Relaxed);
                }
                Ok(())
            })
        }));
        unsafe { core.add_WebResourceRequested(&handler, &mut token)? };

        // Yeni üst düzey gezinme (iptal edilenler hariç: ör. dış bağlantı sistem tarayıcısında açıldıysa).
        let v = view.clone();
        let handler = NavigationStartingEventHandler::create(Box::new(move |_sender, args| {
            guarded(|| {
                let Some(args) = args else { return Ok(()) };
                let mut cancel = BOOL::default();
                if unsafe { args.Cancel(&mut cancel) }.is_ok() && cancel.as_bool() {
                    return Ok(());
                }
                let mut p = PWSTR::null();
                unsafe { args.Uri(&mut p)? };
                v.on_navigation(&take_pwstr(p));
                Ok(())
            })
        }));
        unsafe { core.add_NavigationStarting(&handler, &mut token)? };

        // Aynı belge içi gezinme (SPA, ör. YouTube): kaynak adresi güncellenir, sayaç sıfırlanmaz.
        let v = view.clone();
        let handler = SourceChangedEventHandler::create(Box::new(move |sender, _args| {
            guarded(|| {
                let Some(core) = sender else { return Ok(()) };
                let src = unsafe { source_of(&core) };
                if !src.is_empty() {
                    *lock(&v.page_url) = src;
                    v.refresh_active();
                }
                Ok(())
            })
        }));
        unsafe { core.add_SourceChanged(&handler, &mut token)? };

        let v = view.clone();
        let handler = ContentLoadingEventHandler::create(Box::new(move |sender, _args| {
            guarded(|| {
                if let Some(core) = sender {
                    unsafe {
                        push_runtime_flag(&core, &v);
                        inject_cosmetics(&core, &v);
                    }
                }
                Ok(())
            })
        }));
        unsafe { core.add_ContentLoading(&handler, &mut token)? };

        if let Ok(core2) = core.cast::<ICoreWebView2_2>() {
            let v = view.clone();
            let handler = DOMContentLoadedEventHandler::create(Box::new(move |sender, _args| {
                guarded(|| {
                    if let Some(core) = sender {
                        unsafe {
                            inject_cosmetics(&core, &v);
                            generic_pass(&core, &v);
                        }
                    }
                    Ok(())
                })
            }));
            unsafe { core2.add_DOMContentLoaded(&handler, &mut token)? };
        }

        let v = view.clone();
        let handler = NavigationCompletedEventHandler::create(Box::new(move |sender, _args| {
            guarded(|| {
                if let Some(core) = sender {
                    unsafe { generic_pass(&core, &v) };
                }
                Ok(())
            })
        }));
        unsafe { core.add_NavigationCompleted(&handler, &mut token)? };

        unsafe {
            register_script(&core, &view);
            // Webview zaten bir sayfa yüklediyse (bağlama, oluşturmadan hemen sonra yapılır) geçerli belgeye de uygula.
            exec(&core, &youtube_js());
            inject_cosmetics(&core, &view);
        }
        Ok(())
    }

    /// YouTube betiğini her yeni belgeye eklenecek şekilde (yeniden) kaydeder; eski kayıtlar kaldırılır.
    unsafe fn register_script(core: &ICoreWebView2, view: &Arc<ViewState>) {
        let old: Vec<String> = std::mem::take(&mut *lock(&view.script_ids));
        for id in old {
            let _ = unsafe { core.RemoveScriptToExecuteOnDocumentCreated(&HSTRING::from(id)) };
        }
        if !lock_read(&shared().config).enabled {
            return;
        }
        let v = view.clone();
        let handler = AddScriptToExecuteOnDocumentCreatedCompletedHandler::create(Box::new(move |result, id| {
            if result.is_ok() && !id.is_empty() {
                lock(&v.script_ids).push(id);
            }
            Ok(())
        }));
        let _ = unsafe { core.AddScriptToExecuteOnDocumentCreated(&HSTRING::from(youtube_js()), &handler) };
    }

    unsafe fn push_runtime_flag(core: &ICoreWebView2, view: &ViewState) {
        let on = view.active.load(Ordering::Relaxed);
        unsafe { exec(core, &format!("window.__alpicimAbOn = {on};")) };
    }

    pub(super) unsafe fn on_config_changed(core: &ICoreWebView2, view: &Arc<ViewState>) {
        unsafe {
            register_script(core, view);
            push_runtime_flag(core, view);
        }
        if view.active.load(Ordering::Relaxed) {
            *lock(&view.cosmetic) = None;
            lock(&view.applied_generic).clear();
            unsafe {
                inject_cosmetics(core, view);
                generic_pass(core, view);
            }
        } else {
            let js = format!(
                "(() => {{ for (const id of ['{STYLE_ID}', '{GENERIC_STYLE_ID}']) document.getElementById(id)?.remove(); }})()"
            );
            unsafe { exec(core, &js) };
        }
    }

    /// Alan adına özgü ve genel (sınıf/kimlik dışı) gizleme seçicilerini `<style>` olarak ekler.
    unsafe fn inject_cosmetics(core: &ICoreWebView2, view: &ViewState) {
        if !view.active.load(Ordering::Relaxed) {
            return;
        }
        let Some(engine) = current_engine() else { return };
        let url = lock(&view.page_url).clone();
        if !url.starts_with("http") {
            return;
        }
        let css = {
            let mut cache = lock(&view.cosmetic);
            match cache.as_ref() {
                Some(c) if c.url == url => c.css.clone(),
                _ => {
                    let res = engine.url_cosmetic_resources(&url);
                    let css = build_css(res.hide_selectors.iter());
                    *cache = Some(Cosmetic { url, css: css.clone(), exceptions: res.exceptions, generichide: res.generichide });
                    css
                }
            }
        };
        if !css.is_empty() {
            unsafe { exec(core, &style_js(STYLE_ID, &css, false)) };
        }
    }

    /// Sayfadaki sınıf/kimlikleri toplar, genel kurallardan eşleşenleri ekler (önceden eklenenler atlanır).
    unsafe fn generic_pass(core: &ICoreWebView2, view: &Arc<ViewState>) {
        if !view.active.load(Ordering::Relaxed) {
            return;
        }
        let ready = lock(&view.cosmetic).as_ref().is_some_and(|c| !c.generichide);
        if !ready {
            return;
        }
        let v = view.clone();
        let target = core.clone();
        let handler = ExecuteScriptCompletedHandler::create(Box::new(move |result, json| {
            guarded(|| {
                result?;
                let Ok(found) = serde_json::from_str::<Found>(&json) else { return Ok(()) };
                let Some(engine) = current_engine() else { return Ok(()) };
                let exceptions = match lock(&v.cosmetic).as_ref() {
                    Some(c) => c.exceptions.clone(),
                    None => return Ok(()),
                };
                let selectors = engine.hidden_class_id_selectors(&found.c, &found.i, &exceptions);
                let fresh: Vec<String> = {
                    let mut applied = lock(&v.applied_generic);
                    selectors.into_iter().filter(|s| applied.insert(s.clone())).collect()
                };
                let css = build_css(fresh.iter());
                if !css.is_empty() {
                    unsafe { exec(&target, &style_js(GENERIC_STYLE_ID, &css, true)) };
                }
                Ok(())
            })
        }));
        let _ = unsafe { core.ExecuteScript(&HSTRING::from(COLLECT_JS), &handler) };
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Komutlar
// ---------------------------------------------------------------------------------------------------------------

#[tauri::command]
pub async fn adblock_status() -> AdblockStatus {
    status()
}

#[tauri::command]
pub async fn adblock_set_enabled<R: Runtime>(app: AppHandle<R>, enabled: bool) -> Result<AdblockStatus, String> {
    let cfg = {
        let mut cfg = lock_write(&shared().config);
        cfg.enabled = enabled;
        cfg.clone()
    };
    save_config(&cfg)?;
    apply_config_to_views(&app);
    Ok(status())
}

/// Tüm listeleri yeniden indirir ve motoru yeniden kurar.
#[tauri::command]
pub async fn adblock_update() -> Result<AdblockStatus, String> {
    update(true).await;
    Ok(status())
}

/// `allowed = true`: bu alan adında reklam engelleme kapalı.
#[tauri::command]
pub async fn adblock_site_allow<R: Runtime>(app: AppHandle<R>, host: String, allowed: bool) -> Result<AdblockStatus, String> {
    let host = normalize_host(&host).ok_or("Geçersiz alan adı")?;
    let cfg = {
        let mut cfg = lock_write(&shared().config);
        cfg.allowlist.retain(|h| h != &host);
        if allowed {
            if cfg.allowlist.len() >= MAX_ALLOWLIST {
                return Err(format!("İzin listesi en fazla {MAX_ALLOWLIST} alan adı içerebilir"));
            }
            cfg.allowlist.push(host);
            cfg.allowlist.sort();
        }
        cfg.clone()
    };
    save_config(&cfg)?;
    apply_config_to_views(&app);
    Ok(status())
}

#[cfg(test)]
mod tests {
    use super::*;

    const LIST: &str = "! Title: Test\n\
        [Adblock Plus 2.0]\n\
        ||ads.example.com^\n\
        ||tracker.test^$third-party\n\
        @@||ads.example.com/allowed.js\n\
        /banner/*$image\n\
        example.org##.banner-ad\n\
        ##.generic-ad\n";

    fn engine() -> Engine {
        build_engine(&[("test".into(), LIST.into())])
    }

    #[test]
    fn engine_is_send_sync() {
        fn assert<T: Send + Sync>() {}
        assert::<Engine>();
    }

    #[test]
    fn blocks_known_ad_and_allows_normal() {
        let e = engine();
        let page = "https://news.site/article";
        assert!(decide(&e, "https://ads.example.com/x.js", page, 6, false));
        assert!(decide(&e, "https://ads.example.com/pixel.gif", page, 3, false));
        assert!(!decide(&e, "https://news.site/app.js", page, 6, false));
        assert!(!decide(&e, "https://cdn.news.site/img.png", page, 3, false));
        // İstisna kuralı
        assert!(!decide(&e, "https://ads.example.com/allowed.js", page, 6, false));
        // $third-party: aynı site içinden yüklenince engellenmez
        assert!(decide(&e, "https://tracker.test/t.js", page, 6, false));
        assert!(!decide(&e, "https://tracker.test/t.js", "https://tracker.test/", 6, false));
        // $image: yalnızca görsellerde
        assert!(decide(&e, "https://cdn.site/banner/a.png", page, 3, false));
        assert!(!decide(&e, "https://cdn.site/banner/a.js", page, 6, false));
        // Üst düzey belge ve http dışı adresler asla engellenmez
        assert!(!decide(&e, "https://ads.example.com/", "", 1, true));
        assert!(!decide(&e, "data:text/plain,ads.example.com", page, 3, false));
        // Alt çerçeve belgesi engellenir
        assert!(decide(&e, "https://ads.example.com/frame.html", page, 1, false));
    }

    #[test]
    fn cosmetic_rules() {
        let e = engine();
        let res = e.url_cosmetic_resources("https://www.example.org/page");
        assert!(res.hide_selectors.contains(".banner-ad"));
        let other = e.url_cosmetic_resources("https://example.net/");
        assert!(!other.hide_selectors.contains(".banner-ad"));
        let generic = e.hidden_class_id_selectors(["generic-ad", "content"], Vec::<String>::new(), &HashSet::new());
        assert_eq!(generic, vec![".generic-ad".to_string()]);
    }

    #[test]
    fn maps_resource_types() {
        assert_eq!(resource_type(1), "sub_frame");
        assert_eq!(resource_type(2), "stylesheet");
        assert_eq!(resource_type(3), "image");
        assert_eq!(resource_type(6), "script");
        assert_eq!(resource_type(7), "xmlhttprequest");
        assert_eq!(resource_type(8), "xmlhttprequest");
        assert_eq!(resource_type(11), "websocket");
        assert_eq!(resource_type(14), "ping");
        assert_eq!(resource_type(0), "other");
        assert_eq!(resource_type(99), "other");
    }

    #[test]
    fn normalizes_hosts() {
        assert_eq!(normalize_host("https://www.Example.com/path?q=1").as_deref(), Some("example.com"));
        assert_eq!(normalize_host("  haber.com.tr ").as_deref(), Some("haber.com.tr"));
        assert_eq!(normalize_host("music.youtube.com").as_deref(), Some("music.youtube.com"));
        assert_eq!(normalize_host("örnek.com").as_deref(), Some("xn--rnek-4qa.com"));
        assert_eq!(normalize_host(""), None);
        assert_eq!(normalize_host("not a host"), None);
        assert_eq!(normalize_host("ftp://example.com"), None);
        assert_eq!(normalize_host("intranet"), None);
    }

    #[test]
    fn allowlist_matches_subdomains_only() {
        let list = vec!["example.com".to_string()];
        assert!(is_allowlisted("https://example.com/", &list));
        assert!(is_allowlisted("https://www.example.com/a", &list));
        assert!(is_allowlisted("https://m.example.com/", &list));
        assert!(!is_allowlisted("https://badexample.com/", &list));
        assert!(!is_allowlisted("https://example.com.evil.net/", &list));
        assert!(!is_allowlisted("about:blank", &list));

        let cfg = Config { enabled: true, allowlist: list };
        assert!(!page_active("https://example.com/", &cfg));
        assert!(page_active("https://other.com/", &cfg));
        assert!(!page_active("https://other.com/", &Config { enabled: false, allowlist: vec![] }));
    }

    #[test]
    fn sanitizes_config() {
        let cfg = Config { enabled: true, allowlist: vec!["WWW.B.com".into(), "a.com".into(), "b.com".into(), "bad host".into()] }.sanitized();
        assert_eq!(cfg.allowlist, vec!["a.com".to_string(), "b.com".to_string()]);
        let parsed: Config = serde_json::from_str("{}").unwrap();
        assert!(parsed.enabled);
    }

    /// Gerçek listelerle elle deneme: `ALPICIM_ADBLOCK_LISTS=<klasör> cargo test -- --ignored real_lists --nocapture`
    /// (klasörde `<id>.txt` dosyaları). Ağ kullanmaz.
    #[test]
    #[ignore]
    fn real_lists() {
        let Ok(dir) = std::env::var("ALPICIM_ADBLOCK_LISTS") else { return };
        let texts: Vec<(String, String)> = LISTS
            .iter()
            .filter_map(|l| Some((l.id.to_string(), std::fs::read_to_string(PathBuf::from(&dir).join(format!("{}.txt", l.id))).ok()?)))
            .collect();
        let started = std::time::Instant::now();
        let e = build_engine(&texts);
        println!("{} liste, {} kural, kurulum {:?}", texts.len(), texts.iter().map(|(_, t)| count_rules(t)).sum::<u32>(), started.elapsed());
        let page = "https://www.hurriyet.com.tr/";
        for (url, ctx, expect) in [
            ("https://securepubads.g.doubleclick.net/tag/js/gpt.js", 6, true),
            ("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js", 6, true),
            ("https://www.google-analytics.com/analytics.js", 6, true),
            ("https://www.youtube.com/pagead/adview?ai=x", 8, true),
            ("https://www.hurriyet.com.tr/static/app.js", 6, false),
            ("https://i.ytimg.com/vi/abc/hqdefault.jpg", 3, false),
        ] {
            let started = std::time::Instant::now();
            let got = decide(&e, url, page, ctx, false);
            println!("{got:5} {:?} {url}", started.elapsed());
            assert_eq!(got, expect, "{url}");
        }
        let res = e.url_cosmetic_resources("https://www.youtube.com/watch?v=x");
        println!("youtube: {} seçici, generichide={}", res.hide_selectors.len(), res.generichide);
    }

    #[test]
    fn counts_rules_and_builds_css() {
        assert_eq!(count_rules(LIST), 6);
        let css = build_css([".a".to_string(), "x{}".to_string(), " ".to_string(), "#b > c".to_string()].iter());
        assert_eq!(css, ".a{display:none!important}\n#b > c{display:none!important}\n");
    }
}
