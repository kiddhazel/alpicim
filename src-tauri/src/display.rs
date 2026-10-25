//! Ekran yönetimi: monitör listesi, hedef monitör seçimi, kenarlıksız tam ekran ve pencere moduna dönüş.
//!
//! - Tam ekran, Windows'un "kenarlıksız tam ekran" yöntemidir (çözünürlük değişmez, Alt+Tab ve diğer
//!   monitörler normal çalışır). Özel (exclusive) tam ekran kullanılmaz.
//! - Tercih `layout.json` içinde saklanır; uygulama açılırken webview yüklenmeden uygulanır.
//! - Hedef: seçilen monitör → yoksa ikinci (birincil olmayan) monitör → yoksa birincil monitör.
//! - Monitör takılıp çıkarıldığında (arka plan denetimi, 2 sn) tam ekran yeniden uygulanır.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Runtime, Window};

use crate::geometry::{center_in, monitor_at, pick_monitor, MonitorInfo, Rect};
use crate::windows::{LayoutState, MAIN_LABEL};

pub const DISPLAY_CHANGED_EVENT: &str = "alpicim://display-changed";

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DisplayMode {
    #[default]
    Window,
    Fullscreen,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DisplayPrefs {
    pub mode: DisplayMode,
    /// Tercih edilen monitörün Windows adı (ör. `\\.\DISPLAY2`); `None` → otomatik.
    pub monitor: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorView {
    pub id: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
    pub primary: bool,
    /// Ana pencerenin şu an bulunduğu monitör.
    pub current: bool,
    /// Tercihe göre seçilen hedef monitör.
    pub target: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplaySnapshot {
    pub prefs: DisplayPrefs,
    pub monitors: Vec<MonitorView>,
    pub fullscreen: bool,
}

/// Son görülen monitör düzeninin imzası (takılıp çıkarılma algılaması için).
#[derive(Default)]
pub struct DisplayState {
    signature: Mutex<String>,
}

struct Monitors {
    infos: Vec<MonitorInfo>,
    work: Vec<Rect>,
    scales: Vec<f64>,
}

fn read_monitors<R: Runtime>(window: &Window<R>) -> Monitors {
    let list = window.available_monitors().unwrap_or_default();
    let primary = window.primary_monitor().ok().flatten();
    let mut out = Monitors { infos: Vec::new(), work: Vec::new(), scales: Vec::new() };
    for (i, m) in list.iter().enumerate() {
        let pos = m.position();
        let size = m.size();
        let name = m.name().cloned().unwrap_or_else(|| format!("monitor-{i}"));
        let is_primary = primary
            .as_ref()
            .is_some_and(|p| p.position() == pos && p.size() == size);
        let wa = m.work_area();
        out.infos.push(MonitorInfo {
            name,
            rect: Rect::new(pos.x, pos.y, size.width, size.height),
            primary: is_primary,
        });
        out.work.push(Rect::new(wa.position.x, wa.position.y, wa.size.width, wa.size.height));
        out.scales.push(m.scale_factor());
    }
    out
}

fn signature(m: &Monitors) -> String {
    m.infos
        .iter()
        .map(|i| format!("{}@{},{},{}x{}", i.name, i.rect.x, i.rect.y, i.rect.width, i.rect.height))
        .collect::<Vec<_>>()
        .join("|")
}

/// Pencerenin merkezinin bulunduğu monitör.
fn current_index<R: Runtime>(window: &Window<R>, m: &Monitors) -> Option<usize> {
    let pos = window.outer_position().ok()?;
    let size = window.outer_size().ok()?;
    let cx = pos.x + (size.width / 2) as i32;
    let cy = pos.y + (size.height / 2) as i32;
    monitor_at(&m.infos, cx, cy)
}

pub fn snapshot<R: Runtime>(window: &Window<R>, prefs: &DisplayPrefs) -> DisplaySnapshot {
    let m = read_monitors(window);
    let current = current_index(window, &m);
    let target = pick_monitor(&m.infos, prefs.monitor.as_deref());
    let monitors = m
        .infos
        .iter()
        .enumerate()
        .map(|(i, info)| MonitorView {
            id: info.name.clone(),
            x: info.rect.x,
            y: info.rect.y,
            width: info.rect.width,
            height: info.rect.height,
            scale: m.scales.get(i).copied().unwrap_or(1.0),
            primary: info.primary,
            current: current == Some(i),
            target: target == Some(i),
        })
        .collect();
    DisplaySnapshot {
        prefs: prefs.clone(),
        monitors,
        fullscreen: window.is_fullscreen().unwrap_or(false),
    }
}

/// Pencereyi hedef monitörde kenarlıksız tam ekrana alır (zaten oradaysa bir şey yapmaz).
fn enter_fullscreen<R: Runtime>(window: &Window<R>, prefs: &DisplayPrefs) -> Result<(), String> {
    let m = read_monitors(window);
    let Some(target) = pick_monitor(&m.infos, prefs.monitor.as_deref()) else {
        return window.set_fullscreen(true).map_err(|e| e.to_string());
    };
    let rect = m.infos[target].rect;
    if window.is_fullscreen().unwrap_or(false) {
        let on_target = current_index(window, &m) == Some(target);
        let size_ok = window
            .outer_size()
            .map(|s| s.width == rect.width && s.height == rect.height)
            .unwrap_or(false);
        if on_target && size_ok {
            return Ok(());
        }
        window.set_fullscreen(false).map_err(|e| e.to_string())?;
    }
    if window.is_minimized().unwrap_or(false) {
        let _ = window.unminimize();
    }
    // Büyütülmüş pencere küçültülmez: tam ekrandan çıkınca pencere büyütülmüş hâline (aynı monitörde) döner.
    // (unmaximize, Windows'un hiç güncellenmemiş "normal" konumuna — çoğu zaman birincil monitöre — atıyordu.)
    window
        .set_fullscreen_on_monitor(PhysicalPosition::new(rect.x as f64, rect.y as f64))
        .map_err(|e| e.to_string())
}

/// Pencere modunda pencereyi hedef monitörün çalışma alanına ortalar (sığmıyorsa küçültür).
fn move_window_to_target<R: Runtime>(window: &Window<R>, prefs: &DisplayPrefs) -> Result<(), String> {
    let m = read_monitors(window);
    let target = pick_monitor(&m.infos, prefs.monitor.as_deref()).ok_or("Monitör bulunamadı")?;
    if current_index(window, &m) == Some(target) {
        return Ok(());
    }
    let work = m.work[target];
    let size = window.outer_size().map_err(|e| e.to_string())?;
    // Monitörler arası ölçek farkını hesaba kat: aynı mantıksal boyut korunur.
    let from_scale = window.scale_factor().unwrap_or(1.0);
    let to_scale = m.scales[target];
    let ratio = if from_scale > 0.0 { to_scale / from_scale } else { 1.0 };
    let w = ((size.width as f64 * ratio) as u32).min((work.width as f64 * 0.95) as u32);
    let h = ((size.height as f64 * ratio) as u32).min((work.height as f64 * 0.95) as u32);
    let r = center_in(w, h, work);
    let _ = window.unmaximize();
    window.set_position(PhysicalPosition::new(r.x, r.y)).map_err(|e| e.to_string())?;
    window.set_size(PhysicalSize::new(r.width, r.height)).map_err(|e| e.to_string())
}

/// Tercihi ana pencereye uygular.
pub fn apply<R: Runtime>(window: &Window<R>, prefs: &DisplayPrefs, move_in_window_mode: bool) -> Result<(), String> {
    match prefs.mode {
        DisplayMode::Fullscreen => enter_fullscreen(window, prefs),
        DisplayMode::Window => {
            if window.is_fullscreen().unwrap_or(false) {
                window.set_fullscreen(false).map_err(|e| e.to_string())?;
            }
            if move_in_window_mode {
                move_window_to_target(window, prefs)?;
            }
            Ok(())
        }
    }
}

/// Açılışta (pencere gösterilmeden önce) kayıtlı tercihi uygular.
pub fn apply_saved<R: Runtime>(window: &Window<R>, state: &LayoutState) {
    let prefs = state.display();
    if prefs.mode == DisplayMode::Fullscreen {
        if let Err(err) = enter_fullscreen(window, &prefs) {
            eprintln!("Tam ekran uygulanamadı: {err}");
        }
    }
    if let Some(ds) = window.app_handle().try_state::<DisplayState>() {
        *ds.signature.lock().unwrap_or_else(|e| e.into_inner()) = signature(&read_monitors(window));
    }
}

/// Tam ekran tercihi açıksa ve pencere tam ekranda değilse yeniden uygular (tepsiden geri gelme vb.).
pub fn ensure<R: Runtime>(window: &Window<R>, state: &LayoutState) {
    let prefs = state.display();
    if prefs.mode == DisplayMode::Fullscreen && !window.is_fullscreen().unwrap_or(false) {
        let _ = enter_fullscreen(window, &prefs);
    }
}

fn emit_snapshot<R: Runtime>(app: &AppHandle<R>, window: &Window<R>, prefs: &DisplayPrefs) {
    let _ = app.emit(DISPLAY_CHANGED_EVENT, snapshot(window, prefs));
}

/// Tam ekran ↔ pencere geçişi (kısayol, tepsi menüsü, F11).
pub fn toggle_fullscreen<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    eprintln!("[display] tam ekran geçişi istendi");
    let main = app.get_window(MAIN_LABEL).ok_or("Ana pencere bulunamadı")?;
    let state = app.state::<LayoutState>();
    let mut prefs = state.display();
    prefs.mode = if main.is_fullscreen().unwrap_or(false) { DisplayMode::Window } else { DisplayMode::Fullscreen };
    state.set_display(prefs.clone());
    let _ = main.unminimize();
    let _ = main.show();
    apply(&main, &prefs, false)?;
    let _ = main.set_focus();
    emit_snapshot(app, &main, &prefs);
    Ok(())
}

/// Arka plan denetimi: monitör düzeni değiştiyse tam ekranı doğru monitöre yeniden uygular.
pub fn watch<R: Runtime>(app: &AppHandle<R>) {
    let (Some(main), Some(ds), Some(state)) = (
        app.get_window(MAIN_LABEL),
        app.try_state::<DisplayState>(),
        app.try_state::<LayoutState>(),
    ) else {
        return;
    };
    let m = read_monitors(&main);
    if m.infos.is_empty() {
        return;
    }
    let sig = signature(&m);
    let changed = {
        let mut last = ds.signature.lock().unwrap_or_else(|e| e.into_inner());
        if *last == sig {
            false
        } else {
            *last = sig;
            true
        }
    };
    if !changed {
        return;
    }
    let prefs = state.display();
    if prefs.mode == DisplayMode::Fullscreen && main.is_visible().unwrap_or(false) {
        // Önce çıkıp sonra hedefe yeniden girmek, çıkarılan monitörden kalan yanlış boyutu temizler.
        let _ = main.set_fullscreen(false);
        let _ = enter_fullscreen(&main, &prefs);
    }
    emit_snapshot(app, &main, &prefs);
}

// ---------------------------------------------------------------------------
// Komutlar
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn display_get<R: Runtime>(app: AppHandle<R>, state: tauri::State<'_, LayoutState>) -> Result<DisplaySnapshot, String> {
    let main = app.get_window(MAIN_LABEL).ok_or("Ana pencere bulunamadı")?;
    Ok(snapshot(&main, &state.display()))
}

/// Ekran modu ve hedef monitörü kaydeder ve hemen uygular. `monitor` boşsa otomatik seçim.
#[tauri::command]
pub async fn display_set<R: Runtime>(
    app: AppHandle<R>,
    mode: DisplayMode,
    monitor: Option<String>,
) -> Result<DisplaySnapshot, String> {
    let main = app.get_window(MAIN_LABEL).ok_or("Ana pencere bulunamadı")?;
    let state = app.state::<LayoutState>();
    let previous = state.display();
    let prefs = DisplayPrefs { mode, monitor: monitor.filter(|m| !m.trim().is_empty()) };
    state.set_display(prefs.clone());
    // Pencere modunda monitör değiştiyse pencere o monitöre taşınır.
    let moved_target = previous.monitor != prefs.monitor;
    apply(&main, &prefs, moved_target)?;
    let snap = snapshot(&main, &prefs);
    let _ = app.emit(DISPLAY_CHANGED_EVENT, snap.clone());
    Ok(snap)
}

/// Ana pencereyi hedef monitöre taşır (yanlış ekranda açıldıysa).
#[tauri::command]
pub async fn display_move_to_target<R: Runtime>(app: AppHandle<R>) -> Result<DisplaySnapshot, String> {
    let main = app.get_window(MAIN_LABEL).ok_or("Ana pencere bulunamadı")?;
    let state = app.state::<LayoutState>();
    let prefs = state.display();
    match prefs.mode {
        DisplayMode::Fullscreen => {
            let _ = main.set_fullscreen(false);
            enter_fullscreen(&main, &prefs)?;
        }
        DisplayMode::Window => move_window_to_target(&main, &prefs)?,
    }
    let snap = snapshot(&main, &prefs);
    let _ = app.emit(DISPLAY_CHANGED_EVENT, snap.clone());
    Ok(snap)
}

#[tauri::command]
pub async fn display_toggle_fullscreen<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    toggle_fullscreen(&app)
}
