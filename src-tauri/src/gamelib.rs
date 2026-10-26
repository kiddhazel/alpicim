//! Oyun kütüphanesi (Steam / Epic / Riot taraması) ve oyun modu (ön plandaki oyunu algılama).
//!
//! Güvenlik: oyunlar yalnızca bu taramanın sonucundan başlatılır (`gamelib_launch(id)`); webview yol/URL veremez.
//! Başlatma: Steam → `steam://rungameid/<appid>`, Epic → `com.epicgames.launcher://apps/…`, Riot → sabit argümanlı istemci.
//! Ayrıştırıcılar (VDF/ACF, Epic manifest, Riot JSON) saftır ve birim testlidir.

use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

#[cfg(windows)]
const GAME_MODE_EVENT: &str = "alpicim://game-mode";

// --- Saf ayrıştırıcılar ---------------------------------------------------------------

/// Valve KeyValues (VDF) ağacı.
#[derive(Clone, Debug, PartialEq)]
pub enum Vdf {
    Str(String),
    Map(Vec<(String, Vdf)>),
}

impl Vdf {
    pub fn get(&self, key: &str) -> Option<&Vdf> {
        match self {
            Vdf::Map(items) => items.iter().find(|(k, _)| k.eq_ignore_ascii_case(key)).map(|(_, v)| v),
            Vdf::Str(_) => None,
        }
    }
    pub fn str(&self, key: &str) -> Option<&str> {
        match self.get(key)? {
            Vdf::Str(s) => Some(s),
            Vdf::Map(_) => None,
        }
    }
}

#[derive(Debug, PartialEq)]
enum Tok {
    Str(String),
    Open,
    Close,
}

fn tokenize(text: &str) -> Vec<Tok> {
    let mut out = Vec::new();
    let mut it = text.chars().peekable();
    while let Some(c) = it.next() {
        match c {
            '{' => out.push(Tok::Open),
            '}' => out.push(Tok::Close),
            '"' => {
                let mut s = String::new();
                while let Some(ch) = it.next() {
                    match ch {
                        '"' => break,
                        '\\' => match it.next() {
                            Some('n') => s.push('\n'),
                            Some('t') => s.push('\t'),
                            Some(o) => s.push(o),
                            None => break,
                        },
                        o => s.push(o),
                    }
                }
                out.push(Tok::Str(s));
            }
            '/' if it.peek() == Some(&'/') => {
                for ch in it.by_ref() {
                    if ch == '\n' {
                        break;
                    }
                }
            }
            _ => {}
        }
    }
    out
}

fn parse_map(toks: &[Tok], pos: &mut usize, depth: usize) -> Option<Vdf> {
    if depth > 16 {
        return None;
    }
    let mut items = Vec::new();
    while *pos < toks.len() {
        match &toks[*pos] {
            Tok::Close => {
                *pos += 1;
                return Some(Vdf::Map(items));
            }
            Tok::Open => return None,
            Tok::Str(key) => {
                *pos += 1;
                match toks.get(*pos)? {
                    Tok::Str(v) => {
                        items.push((key.clone(), Vdf::Str(v.clone())));
                        *pos += 1;
                    }
                    Tok::Open => {
                        *pos += 1;
                        items.push((key.clone(), parse_map(toks, pos, depth + 1)?));
                    }
                    Tok::Close => return None,
                }
            }
        }
    }
    Some(Vdf::Map(items))
}

pub fn parse_vdf(text: &str) -> Option<Vdf> {
    let toks = tokenize(text);
    let mut pos = 0;
    parse_map(&toks, &mut pos, 0)
}

/// `libraryfolders.vdf` → kitaplık klasörleri (yeni biçim: `path`, eski biçim: doğrudan metin).
pub fn steam_library_paths(vdf: &Vdf) -> Vec<String> {
    let Some(Vdf::Map(items)) = vdf.get("libraryfolders") else { return Vec::new() };
    let mut out = Vec::new();
    for (key, value) in items {
        if key.is_empty() || !key.bytes().all(|b| b.is_ascii_digit()) {
            continue;
        }
        let path = match value {
            Vdf::Str(s) => Some(s.as_str()),
            map => map.str("path"),
        };
        if let Some(p) = path.filter(|p| !p.trim().is_empty()) {
            out.push(p.to_string());
        }
    }
    out
}

#[derive(Clone, Debug, PartialEq)]
pub struct SteamApp {
    pub app_id: u32,
    pub name: String,
    pub install_dir: String,
}

/// Araç / yeniden dağıtılabilir paketleri oyun listesinden çıkarır.
pub fn is_steam_tool(app_id: u32, name: &str) -> bool {
    const IDS: &[u32] = &[228980, 250820, 1493710, 1391110, 1628350, 1070560, 1887720];
    let n = name.to_lowercase();
    IDS.contains(&app_id)
        || ["steamworks", "redistributable", "steam linux runtime", "proton", "steamvr", "soundtrack", "dedicated server", " sdk"]
            .iter()
            .any(|w| n.contains(w))
}

pub fn parse_acf(text: &str) -> Option<SteamApp> {
    let vdf = parse_vdf(text)?;
    let state = vdf.get("AppState")?;
    let app_id = state.str("appid")?.trim().parse::<u32>().ok()?;
    let name = state.str("name")?.trim().to_string();
    let install_dir = state.str("installdir")?.trim().to_string();
    if name.is_empty() || install_dir.is_empty() || is_steam_tool(app_id, &name) {
        return None;
    }
    // installdir yalnız tek bir klasör adı olmalı.
    if install_dir.contains(['/', '\\']) || install_dir.contains("..") {
        return None;
    }
    Some(SteamApp { app_id, name, install_dir })
}

#[derive(Clone, Debug, PartialEq)]
pub struct EpicGame {
    pub app_name: String,
    pub name: String,
    pub launch_exe: String,
    pub install_location: String,
    pub namespace: String,
    pub catalog_item: String,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase", default)]
struct EpicRaw {
    display_name: String,
    app_name: String,
    launch_executable: String,
    install_location: String,
    catalog_namespace: String,
    catalog_item_id: String,
    main_game_app_name: String,
    app_categories: Vec<String>,
    #[serde(rename = "bIsIncompleteInstall")]
    is_incomplete_install: bool,
}

fn safe_token(s: &str) -> bool {
    !s.is_empty() && s.len() <= 128 && s.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-' | b'.'))
}

pub fn parse_epic_manifest(json: &str) -> Option<EpicGame> {
    let raw: EpicRaw = serde_json::from_str(json.trim_start_matches('\u{feff}')).ok()?;
    if raw.is_incomplete_install
        || raw.display_name.trim().is_empty()
        || raw.launch_executable.trim().is_empty()
        || raw.install_location.trim().is_empty()
        || !safe_token(&raw.app_name)
    {
        return None;
    }
    // DLC / eklenti: ana oyundan farklı AppName.
    if !raw.main_game_app_name.is_empty() && raw.main_game_app_name != raw.app_name {
        return None;
    }
    if !raw.app_categories.is_empty() && !raw.app_categories.iter().any(|c| c.eq_ignore_ascii_case("games")) {
        return None;
    }
    Some(EpicGame {
        name: raw.display_name.trim().to_string(),
        app_name: raw.app_name,
        launch_exe: raw.launch_executable,
        install_location: raw.install_location,
        namespace: raw.catalog_namespace,
        catalog_item: raw.catalog_item_id,
    })
}

/// Epic başlatma adresi: `Namespace:CatalogItemId:AppName` (':' → %3A); kimlikler yoksa yalnız AppName.
pub fn epic_launch_url(g: &EpicGame) -> String {
    let target = if safe_token(&g.namespace) && safe_token(&g.catalog_item) {
        format!("{}%3A{}%3A{}", g.namespace, g.catalog_item, g.app_name)
    } else {
        g.app_name.clone()
    };
    format!("com.epicgames.launcher://apps/{target}?action=launch&silent=true")
}

/// Riot ürünleri: (kimlik, görünen ad, kurulum klasörü ipucu, `--launch-product` değeri).
const RIOT_PRODUCTS: &[(&str, &str, &str, &str)] = &[
    ("valorant", "VALORANT", "valorant", "valorant"),
    ("lol", "League of Legends", "league of legends", "league_of_legends"),
];

#[derive(Clone, Debug, PartialEq)]
pub struct RiotProduct {
    pub key: &'static str,
    pub name: &'static str,
    pub product: &'static str,
    pub install_dir: String,
}

/// `RiotClientInstalls.json` → (istemci exe yolu, kurulu ürünler). `exists` testlerde taklit edilebilsin diye dışarıdan gelir.
pub fn parse_riot_installs(json: &str, exists: &dyn Fn(&str) -> bool) -> Option<(String, Vec<RiotProduct>)> {
    let v: serde_json::Value = serde_json::from_str(json.trim_start_matches('\u{feff}')).ok()?;
    let client = ["rc_default", "rc_live", "rc_beta"]
        .iter()
        .filter_map(|k| v.get(*k)?.as_str())
        .map(|s| s.replace('/', "\\"))
        .find(|p| p.to_lowercase().ends_with("riotclientservices.exe") && exists(p))?;
    let mut products = Vec::new();
    if let Some(map) = v.get("associated_client").and_then(|m| m.as_object()) {
        for dir in map.keys() {
            let lower = dir.to_lowercase();
            for (key, name, hint, product) in RIOT_PRODUCTS {
                if lower.contains(hint) && !products.iter().any(|p: &RiotProduct| p.key == *key) {
                    products.push(RiotProduct { key, name, product, install_dir: dir.replace('/', "\\") });
                }
            }
        }
    }
    Some((client, products))
}

/// `path`, verilen klasörlerden birinin içinde mi? (büyük/küçük harf duyarsız, klasör sınırına duyarlı)
pub fn path_in_dirs(path: &str, dirs: &[String]) -> bool {
    let p = path.replace('/', "\\").to_lowercase();
    dirs.iter().any(|d| {
        let d = d.replace('/', "\\").to_lowercase();
        let d = d.trim_end_matches('\\');
        !d.is_empty() && p.len() > d.len() && p.starts_with(d) && p.as_bytes()[d.len()] == b'\\'
    })
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

/// Pencere, monitörün tamamını kaplıyor mu?
pub fn covers_monitor(win: Rect, mon: Rect) -> bool {
    win.left <= mon.left && win.top <= mon.top && win.right >= mon.right && win.bottom >= mon.bottom
}

/// Tam ekran olsa bile oyun sayılmayacak süreçler (kabuk, tarayıcılar, oynatıcılar).
pub fn is_excluded_exe(exe_path: &str) -> bool {
    let name = exe_path.rsplit(['\\', '/']).next().unwrap_or("").to_lowercase();
    const EXCLUDED: &[&str] = &[
        "explorer.exe", "shellexperiencehost.exe", "searchhost.exe", "startmenuexperiencehost.exe", "lockapp.exe",
        "applicationframehost.exe", "textinputhost.exe", "msedge.exe", "chrome.exe", "firefox.exe", "brave.exe",
        "opera.exe", "vivaldi.exe", "vlc.exe", "mpv.exe", "mpc-hc64.exe", "potplayermini64.exe", "alpicim.exe",
        "msedgewebview2.exe", "code.exe", "devenv.exe", "powerpnt.exe",
    ];
    EXCLUDED.contains(&name.as_str())
}

// --- Tarama ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
enum Launch {
    Steam(u32),
    Epic(String),
    Riot { exe: String, product: &'static str },
}

#[derive(Clone, Debug)]
struct Game {
    id: String,
    name: String,
    store: &'static str,
    app_id: Option<u32>,
    install_dir: Option<String>,
    /// Simge çıkarılacak exe (varsa).
    icon_exe: Option<String>,
    launch: Launch,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameView {
    pub id: String,
    pub name: String,
    pub store: &'static str,
    /// Yalnız Steam: kapak görseli için.
    pub app_id: Option<u32>,
    pub has_icon: bool,
}

impl From<&Game> for GameView {
    fn from(g: &Game) -> Self {
        GameView { id: g.id.clone(), name: g.name.clone(), store: g.store, app_id: g.app_id, has_icon: g.icon_exe.is_some() }
    }
}

#[derive(Default)]
pub struct GameLibState {
    games: Mutex<Vec<Game>>,
    scanned: Mutex<bool>,
}

impl GameLibState {
    fn set(&self, list: Vec<Game>) {
        *self.games.lock().unwrap_or_else(|e| e.into_inner()) = list;
        *self.scanned.lock().unwrap_or_else(|e| e.into_inner()) = true;
    }
    fn snapshot(&self) -> Vec<Game> {
        self.games.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }
    fn is_scanned(&self) -> bool {
        *self.scanned.lock().unwrap_or_else(|e| e.into_inner())
    }
}

#[cfg(windows)]
fn steam_root() -> Option<PathBuf> {
    use windows::core::w;
    use windows::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_SZ};
    let mut buf = [0u16; 520];
    let mut bytes = (buf.len() * 2) as u32;
    let r = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            w!("Software\\Valve\\Steam"),
            w!("SteamPath"),
            RRF_RT_REG_SZ,
            None,
            Some(buf.as_mut_ptr() as *mut core::ffi::c_void),
            Some(&mut bytes),
        )
    };
    if r.is_ok() {
        let len = (bytes as usize / 2).saturating_sub(1).min(buf.len());
        let s = String::from_utf16_lossy(&buf[..len]);
        if !s.trim().is_empty() {
            return Some(PathBuf::from(s.replace('/', "\\")));
        }
    }
    [r"C:\Program Files (x86)\Steam", r"C:\Program Files\Steam"]
        .iter()
        .map(PathBuf::from)
        .find(|p| p.join("steamapps").is_dir())
}
#[cfg(not(windows))]
fn steam_root() -> Option<PathBuf> {
    None
}

fn scan_steam(out: &mut Vec<Game>) {
    let Some(root) = steam_root() else { return };
    let mut libs: Vec<PathBuf> = vec![root.clone()];
    if let Ok(text) = std::fs::read_to_string(root.join("steamapps").join("libraryfolders.vdf")) {
        if let Some(vdf) = parse_vdf(&text) {
            for p in steam_library_paths(&vdf) {
                let pb = PathBuf::from(p);
                if !libs.iter().any(|l| l.to_string_lossy().eq_ignore_ascii_case(&pb.to_string_lossy())) {
                    libs.push(pb);
                }
            }
        }
    }
    for lib in libs {
        let apps = lib.join("steamapps");
        let Ok(entries) = std::fs::read_dir(&apps) else { continue };
        for entry in entries.flatten() {
            let fname = entry.file_name().to_string_lossy().to_string();
            if !(fname.starts_with("appmanifest_") && fname.ends_with(".acf")) {
                continue;
            }
            let Ok(text) = std::fs::read_to_string(entry.path()) else { continue };
            let Some(app) = parse_acf(&text) else { continue };
            let id = format!("steam-{}", app.app_id);
            if out.iter().any(|g| g.id == id) {
                continue;
            }
            out.push(Game {
                id,
                name: app.name,
                store: "steam",
                app_id: Some(app.app_id),
                install_dir: Some(apps.join("common").join(&app.install_dir).to_string_lossy().to_string()),
                icon_exe: None,
                launch: Launch::Steam(app.app_id),
            });
        }
    }
}

fn scan_epic(out: &mut Vec<Game>) {
    let dir = Path::new(r"C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests");
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        if entry.path().extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("item")) != Some(true) {
            continue;
        }
        let Ok(text) = std::fs::read_to_string(entry.path()) else { continue };
        let Some(g) = parse_epic_manifest(&text) else { continue };
        let exe = Path::new(&g.install_location).join(&g.launch_exe);
        let id = format!("epic-{}", g.app_name.to_lowercase());
        if out.iter().any(|x| x.id == id) {
            continue;
        }
        out.push(Game {
            id,
            name: g.name.clone(),
            store: "epic",
            app_id: None,
            install_dir: Some(g.install_location.clone()),
            icon_exe: exe.is_file().then(|| exe.to_string_lossy().to_string()),
            launch: Launch::Epic(epic_launch_url(&g)),
        });
    }
}

fn scan_riot(out: &mut Vec<Game>) {
    let path = Path::new(r"C:\ProgramData\Riot Games\RiotClientInstalls.json");
    let Ok(text) = std::fs::read_to_string(path) else { return };
    let Some((client, products)) = parse_riot_installs(&text, &|p| Path::new(p).is_file()) else { return };
    for p in products {
        if !Path::new(&p.install_dir).is_dir() {
            continue;
        }
        out.push(Game {
            id: format!("riot-{}", p.key),
            name: p.name.to_string(),
            store: "riot",
            app_id: None,
            install_dir: Some(p.install_dir.clone()),
            icon_exe: Some(client.clone()),
            launch: Launch::Riot { exe: client.clone(), product: p.product },
        });
    }
}

fn scan_all() -> Vec<Game> {
    let mut out = Vec::new();
    scan_steam(&mut out);
    scan_epic(&mut out);
    scan_riot(&mut out);
    out.sort_by_key(|g| g.name.to_lowercase());
    out
}

// --- Komutlar -------------------------------------------------------------------------

#[tauri::command]
pub async fn gamelib_scan<R: Runtime>(app: AppHandle<R>) -> Result<Vec<GameView>, String> {
    let list = tauri::async_runtime::spawn_blocking(scan_all).await.map_err(|e| e.to_string())?;
    let views = list.iter().map(GameView::from).collect();
    app.state::<GameLibState>().set(list);
    Ok(views)
}

#[tauri::command]
pub async fn gamelib_list<R: Runtime>(app: AppHandle<R>) -> Result<Vec<GameView>, String> {
    if !app.state::<GameLibState>().is_scanned() {
        return gamelib_scan(app).await;
    }
    Ok(app.state::<GameLibState>().snapshot().iter().map(GameView::from).collect())
}

fn find_game<R: Runtime>(app: &AppHandle<R>, id: &str) -> Result<Game, String> {
    app.state::<GameLibState>()
        .snapshot()
        .into_iter()
        .find(|g| g.id == id)
        .ok_or_else(|| "Oyun bulunamadı (kütüphaneyi yenileyin)".to_string())
}

/// Yalnızca taranan listedeki bir oyunu kimliğiyle başlatır.
#[tauri::command]
pub async fn gamelib_launch<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let game = find_game(&app, &id)?;
    match game.launch {
        Launch::Steam(app_id) => app
            .opener()
            .open_url(format!("steam://rungameid/{app_id}"), None::<&str>)
            .map_err(|e| format!("Açılamadı: {e}")),
        Launch::Epic(url) => app.opener().open_url(url, None::<&str>).map_err(|e| format!("Açılamadı: {e}")),
        Launch::Riot { exe, product } => std::process::Command::new(&exe)
            .arg(format!("--launch-product={product}"))
            .arg("--launch-patchline=live")
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Açılamadı: {e}")),
    }
}

/// Taranan oyunun exe simgesi (PNG data URL); Steam oyunlarında yok.
#[tauri::command]
pub async fn gamelib_icon<R: Runtime>(app: AppHandle<R>, id: String) -> Result<Option<String>, String> {
    let game = find_game(&app, &id)?;
    let Some(exe) = game.icon_exe else { return Ok(None) };
    let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || crate::scanner::icon_data_url(&cache, Path::new(&exe)))
        .await
        .map_err(|e| e.to_string())
}

// --- Oyun modu ------------------------------------------------------------------------

#[cfg(windows)]
#[derive(Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct GameModePayload {
    active: bool,
    name: String,
}

#[cfg(windows)]
fn foreground_game(dirs: &[(String, String)]) -> Option<String> {
    use windows::core::PWSTR;
    use windows::Win32::Foundation::{CloseHandle, RECT};
    use windows::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
    use windows::Win32::System::Threading::{
        GetCurrentProcessId, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId};

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_invalid() {
            return None;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 || pid == GetCurrentProcessId() {
            return None;
        }
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len).is_ok();
        let _ = CloseHandle(process);
        if !ok {
            return None;
        }
        let exe = String::from_utf16_lossy(&buf[..len as usize]);
        if is_excluded_exe(&exe) {
            return None;
        }
        // 1) Taranan bir oyunun kurulum klasöründeki süreç.
        if let Some((name, _)) = dirs.iter().find(|(_, d)| path_in_dirs(&exe, std::slice::from_ref(d))) {
            return Some(name.clone());
        }
        // 2) Monitörün tamamını kaplayan pencere.
        let mut wr = RECT::default();
        GetWindowRect(hwnd, &mut wr).ok()?;
        let mon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut mi = MONITORINFO { cbSize: std::mem::size_of::<MONITORINFO>() as u32, ..Default::default() };
        if !GetMonitorInfoW(mon, &mut mi).as_bool() {
            return None;
        }
        let w = Rect { left: wr.left, top: wr.top, right: wr.right, bottom: wr.bottom };
        let m = Rect {
            left: mi.rcMonitor.left,
            top: mi.rcMonitor.top,
            right: mi.rcMonitor.right,
            bottom: mi.rcMonitor.bottom,
        };
        if covers_monitor(w, m) {
            let file = exe.rsplit('\\').next().unwrap_or("");
            let stem = file.rsplit_once('.').map(|(s, _)| s).unwrap_or(file);
            return Some(stem.to_string());
        }
        None
    }
}

/// 5 sn'de bir ön plandaki oyunu algılar; yalnızca durum değişince `alpicim://game-mode` yayar.
#[cfg(windows)]
pub fn spawn<R: Runtime>(app: AppHandle<R>) {
    use tauri::Emitter;
    let _ = std::thread::Builder::new().name("alpicim-gamemode".into()).spawn(move || {
        let mut last = GameModePayload { active: false, name: String::new() };
        loop {
            std::thread::sleep(std::time::Duration::from_secs(5));
            let state = app.state::<GameLibState>();
            if !state.is_scanned() {
                state.set(scan_all());
            }
            let dirs: Vec<(String, String)> =
                state.snapshot().into_iter().filter_map(|g| g.install_dir.map(|d| (g.name, d))).collect();
            let now = match foreground_game(&dirs) {
                Some(name) => GameModePayload { active: true, name },
                None => GameModePayload { active: false, name: String::new() },
            };
            if now != last {
                let _ = app.emit(GAME_MODE_EVENT, now.clone());
                last = now;
            }
        }
    });
}

#[cfg(not(windows))]
pub fn spawn<R: Runtime>(_app: AppHandle<R>) {}

#[cfg(test)]
mod tests {
    use super::*;

    const LIBS: &str = r#""libraryfolders"
{
	"0"
	{
		"path"		"C:\\Program Files (x86)\\Steam"
		"apps"
		{
			"228980"		"1"
		}
	}
	"1"
	{
		"path"		"D:\\SteamLibrary"
	}
	"contentstatsid"		"123"
}"#;

    #[test]
    fn library_paths() {
        let v = parse_vdf(LIBS).unwrap();
        assert_eq!(
            steam_library_paths(&v),
            vec![r"C:\Program Files (x86)\Steam".to_string(), r"D:\SteamLibrary".to_string()]
        );
    }

    #[test]
    fn old_library_format() {
        let v = parse_vdf("\"LibraryFolders\"\n{\n\"TimeNextStatsReport\" \"1\"\n\"1\" \"E:\\\\Games\\\\Steam\"\n}").unwrap();
        assert_eq!(steam_library_paths(&v), vec![r"E:\Games\Steam".to_string()]);
    }

    #[test]
    fn acf_game_and_tools() {
        let acf = "\"AppState\"\n{\n\t\"appid\"\t\t\"730\"\n\t\"name\"\t\t\"Counter-Strike 2\"\n\t\"installdir\"\t\t\"Counter-Strike Global Offensive\"\n}";
        let app = parse_acf(acf).unwrap();
        assert_eq!(app.app_id, 730);
        assert_eq!(app.name, "Counter-Strike 2");
        assert_eq!(app.install_dir, "Counter-Strike Global Offensive");
        let tool = "\"AppState\"\n{\n\"appid\" \"228980\"\n\"name\" \"Steamworks Common Redistributables\"\n\"installdir\" \"Steamworks Shared\"\n}";
        assert!(parse_acf(tool).is_none());
        let evil = "\"AppState\"\n{\n\"appid\" \"1\"\n\"name\" \"X\"\n\"installdir\" \"..\\\\..\\\\Windows\"\n}";
        assert!(parse_acf(evil).is_none());
        assert!(parse_acf("garbage {").is_none());
    }

    const EPIC: &str = r#"{
        "FormatVersion": 0, "bIsIncompleteInstall": false,
        "AppCategories": ["public","games","applications"],
        "DisplayName": "Fortnite", "InstallLocation": "C:\\Program Files\\Epic Games\\Fortnite",
        "LaunchExecutable": "FortniteGame\\Binaries\\Win64\\FortniteLauncher.exe",
        "CatalogNamespace": "fn", "CatalogItemId": "4fe75bbc5a674f4f9b356b5c90567da5",
        "AppName": "Fortnite", "MainGameAppName": "Fortnite"
    }"#;

    #[test]
    fn epic_manifest() {
        let g = parse_epic_manifest(EPIC).unwrap();
        assert_eq!(g.name, "Fortnite");
        assert_eq!(
            epic_launch_url(&g),
            "com.epicgames.launcher://apps/fn%3A4fe75bbc5a674f4f9b356b5c90567da5%3AFortnite?action=launch&silent=true"
        );
        let dlc = EPIC.replace("\"MainGameAppName\": \"Fortnite\"", "\"MainGameAppName\": \"Other\"");
        assert!(parse_epic_manifest(&dlc).is_none());
        let bad = EPIC.replace("\"AppName\": \"Fortnite\"", "\"AppName\": \"a/b?x\"");
        assert!(parse_epic_manifest(&bad).is_none());
        let addon = EPIC.replace("\"games\"", "\"addons\"");
        assert!(parse_epic_manifest(&addon).is_none());
        assert!(parse_epic_manifest("{").is_none());
    }

    #[test]
    fn riot_installs() {
        let json = r#"{"rc_default":"C:/Riot Games/Riot Client/RiotClientServices.exe",
            "associated_client":{"C:/Riot Games/VALORANT/live/":"C:/Riot Games/Riot Client/RiotClientServices.exe",
            "C:/Riot Games/League of Legends/":"x"}}"#;
        let (client, products) = parse_riot_installs(json, &|_| true).unwrap();
        assert!(client.ends_with("RiotClientServices.exe"));
        assert_eq!(products.len(), 2);
        assert!(products.iter().any(|p| p.product == "valorant"));
        assert!(products.iter().any(|p| p.product == "league_of_legends"));
        assert!(parse_riot_installs(json, &|_| false).is_none());
    }

    #[test]
    fn path_matching() {
        let dirs = vec![r"D:\SteamLibrary\steamapps\common\Hades".to_string()];
        assert!(path_in_dirs(r"d:\steamlibrary\steamapps\common\hades\x64\Hades.exe", &dirs));
        assert!(!path_in_dirs(r"D:\SteamLibrary\steamapps\common\HadesII\a.exe", &dirs));
        assert!(!path_in_dirs(r"D:\SteamLibrary\steamapps\common\Hades", &dirs));
    }

    #[test]
    fn fullscreen_and_exclusions() {
        let mon = Rect { left: 0, top: 0, right: 1920, bottom: 1080 };
        assert!(covers_monitor(Rect { left: 0, top: 0, right: 1920, bottom: 1080 }, mon));
        assert!(covers_monitor(Rect { left: -8, top: -8, right: 1928, bottom: 1088 }, mon));
        assert!(!covers_monitor(Rect { left: 0, top: 0, right: 1920, bottom: 1040 }, mon));
        assert!(is_excluded_exe(r"C:\Windows\explorer.exe"));
        assert!(is_excluded_exe(r"C:\Program Files\Google\Chrome\Application\chrome.exe"));
        assert!(!is_excluded_exe(r"D:\Games\Hades.exe"));
    }
}
