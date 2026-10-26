//! Pencere yönetimi: panel pencereleri, düzen kalıcılığı, monitör doğrulaması ve hazır düzenler.

use std::{
    collections::{HashMap, HashSet},
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder, Window, WindowEvent,
};

use crate::display::DisplayPrefs;
use crate::geometry::{clamp_to_monitors, Rect};

pub const MAIN_LABEL: &str = "main";
const PANEL_PREFIX: &str = "panel-";
const LAYOUT_FILE: &str = "layout.json";
pub const LAYOUT_CHANGED_EVENT: &str = "alpicim://layout-changed";

/// Ayrı pencerede açılabilen paneller: (kimlik, pencere başlığı, varsayılan genişlik, yükseklik).
const PANELS: &[(&str, &str, f64, f64)] = &[
    ("news", "Alpicim — Haberler", 520.0, 760.0),
    ("markets", "Alpicim — Piyasalar", 480.0, 680.0),
    ("launcher", "Alpicim — Uygulamalar", 560.0, 620.0),
    ("settings", "Alpicim — Ayarlar", 560.0, 680.0),
    ("browser", "Alpicim — Tarayıcı", 1100.0, 780.0),
    ("home", "Alpicim — Ana ekran", 900.0, 700.0),
    ("music", "Alpicim — YouTube Music", 1000.0, 720.0),
    ("apps", "Alpicim — Uygulama pencereleri", 1000.0, 720.0),
    ("notes", "Alpicim — Notlar", 900.0, 680.0),
    ("clipboard", "Alpicim — Pano geçmişi", 520.0, 680.0),
    ("games", "Alpicim — Oyunlar", 560.0, 720.0),
    ("library", "Alpicim — Oyun kütüphanesi", 760.0, 700.0),
    ("room", "Alpicim — Laila'nın odası", 760.0, 640.0),
    ("radio", "Alpicim — Radyo", 520.0, 680.0),
    ("podcasts", "Alpicim — Podcast", 520.0, 680.0),
];

fn panel_spec(panel: &str) -> Option<&'static (&'static str, &'static str, f64, f64)> {
    PANELS.iter().find(|(id, ..)| *id == panel)
}

pub fn panel_label(panel: &str) -> String {
    format!("{PANEL_PREFIX}{panel}")
}

fn panel_from_label(label: &str) -> Option<&str> {
    label.strip_prefix(PANEL_PREFIX)
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WindowRecord {
    pub rect: Option<Rect>,
    pub maximized: bool,
    pub always_on_top: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LayoutFile {
    pub version: u32,
    /// Pencere etiketi → kayıtlı durum.
    pub windows: HashMap<String, WindowRecord>,
    /// Ayrı pencerede açık olan paneller (açılış sırasıyla).
    pub detached: Vec<String>,
    /// Ana pencere kapatıldığında tepsiye gizlensin mi?
    pub close_to_tray: bool,
    /// Ekran modu (pencere / tam ekran) ve hedef monitör.
    pub display: DisplayPrefs,
    /// Sistem çapında kısayollar: eylem → "Ctrl+Alt+F" (boş = kapalı, eksik = varsayılan).
    pub shortcuts: HashMap<String, String>,
    /// Açılışta ana pencere gösterilmeden tepside başlasın mı?
    pub start_hidden: bool,
}

impl Default for LayoutFile {
    fn default() -> Self {
        Self {
            version: 1,
            windows: HashMap::new(),
            detached: Vec::new(),
            close_to_tray: true,
            display: DisplayPrefs::default(),
            shortcuts: HashMap::new(),
            start_hidden: false,
        }
    }
}

/// Webview'e gönderilen düzen özeti.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LayoutSnapshot {
    pub detached: Vec<String>,
    pub always_on_top: HashMap<String, bool>,
    pub close_to_tray: bool,
    pub start_hidden: bool,
}

struct Inner {
    file: LayoutFile,
    dirty: bool,
    /// Geometrisi geri yüklenmiş pencereler. Geri yükleme öncesi olaylar kaydı ezmesin diye.
    tracked: HashSet<String>,
}

pub struct LayoutState {
    inner: Mutex<Inner>,
    path: PathBuf,
    /// Uygulama kapanırken pencerelerin yok edilmesi "panel kapatıldı" sayılmasın.
    pub exiting: AtomicBool,
}

impl LayoutState {
    pub fn load(dir: PathBuf) -> Self {
        let path = dir.join(LAYOUT_FILE);
        let file = fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str::<LayoutFile>(&text).ok())
            .unwrap_or_default();
        let mut file = file;
        // Bilinmeyen/eskimiş panel kimliklerini ayıkla.
        file.detached.retain(|p| panel_spec(p).is_some());
        file.detached.dedup();
        Self {
            inner: Mutex::new(Inner { file, dirty: false, tracked: HashSet::new() }),
            path,
            exiting: AtomicBool::new(false),
        }
    }

    fn with<T>(&self, f: impl FnOnce(&mut Inner) -> T) -> T {
        let mut guard = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        f(&mut guard)
    }

    pub fn snapshot(&self) -> LayoutSnapshot {
        self.with(|inner| LayoutSnapshot {
            detached: inner.file.detached.clone(),
            always_on_top: inner
                .file
                .windows
                .iter()
                .map(|(k, v)| (k.clone(), v.always_on_top))
                .collect(),
            close_to_tray: inner.file.close_to_tray,
            start_hidden: inner.file.start_hidden,
        })
    }

    pub fn close_to_tray(&self) -> bool {
        self.with(|inner| inner.file.close_to_tray)
    }

    pub fn start_hidden(&self) -> bool {
        self.with(|inner| inner.file.start_hidden)
    }

    pub fn display(&self) -> DisplayPrefs {
        self.with(|inner| inner.file.display.clone())
    }

    pub fn set_display(&self, prefs: DisplayPrefs) {
        self.with(|inner| {
            if inner.file.display != prefs {
                inner.file.display = prefs;
                inner.dirty = true;
            }
        });
    }

    pub fn shortcuts(&self) -> HashMap<String, String> {
        self.with(|inner| inner.file.shortcuts.clone())
    }

    pub fn set_shortcuts(&self, shortcuts: HashMap<String, String>) {
        self.with(|inner| {
            inner.file.shortcuts = shortcuts;
            inner.dirty = true;
        });
    }

    pub fn save_if_dirty(&self) {
        let data = self.with(|inner| {
            if !inner.dirty {
                return None;
            }
            inner.dirty = false;
            serde_json::to_string_pretty(&inner.file).ok()
        });
        if let Some(json) = data {
            if let Some(parent) = self.path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            // Yarım yazılmış dosya kalmaması için önce geçici dosyaya yaz, sonra taşı.
            let tmp = self.path.with_extension("json.tmp");
            if fs::write(&tmp, json).is_ok() {
                let _ = fs::rename(&tmp, &self.path);
            }
        }
    }

    fn record(&self, label: &str) -> WindowRecord {
        self.with(|inner| inner.file.windows.get(label).cloned().unwrap_or_default())
    }

    fn update_record(&self, label: &str, f: impl FnOnce(&mut WindowRecord)) {
        self.with(|inner| {
            let rec = inner.file.windows.entry(label.to_string()).or_default();
            f(rec);
            inner.dirty = true;
        });
    }

    fn set_detached(&self, panel: &str, open: bool) {
        self.with(|inner| {
            let list = &mut inner.file.detached;
            let present = list.iter().any(|p| p == panel);
            if open && !present {
                list.push(panel.to_string());
                inner.dirty = true;
            } else if !open && present {
                list.retain(|p| p != panel);
                inner.dirty = true;
            }
        });
    }

    fn track(&self, label: &str) {
        self.with(|inner| {
            inner.tracked.insert(label.to_string());
        });
    }

    fn is_tracked(&self, label: &str) -> bool {
        self.with(|inner| inner.tracked.contains(label))
    }
}

/// Kayıtlı değişiklikleri periyodik olarak diske yazan arka plan iş parçacığı.
pub fn spawn_autosave<R: Runtime>(app: AppHandle<R>) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(2));
        if let Some(state) = app.try_state::<LayoutState>() {
            state.save_if_dirty();
        }
        crate::display::watch(&app);
    });
}

fn work_areas<R: Runtime>(window: &WebviewWindow<R>) -> (Vec<Rect>, Option<Rect>) {
    let to_rect = |m: &tauri::Monitor| {
        let wa = m.work_area();
        Rect::new(wa.position.x, wa.position.y, wa.size.width, wa.size.height)
    };
    let areas: Vec<Rect> = window
        .available_monitors()
        .map(|list| list.iter().map(to_rect).collect())
        .unwrap_or_default();
    let primary = window.primary_monitor().ok().flatten().map(|m| to_rect(&m));
    (areas, primary)
}

/// Kayıtlı geometriyi (monitör doğrulamasından geçirerek) pencereye uygular ve gösterir.
pub fn restore_and_show<R: Runtime>(window: &WebviewWindow<R>, state: &LayoutState) {
    let label = window.label().to_string();
    let record = state.record(&label);

    if let Some(rect) = record.rect {
        let (areas, primary) = work_areas(window);
        let safe = clamp_to_monitors(rect, &areas, primary);
        let _ = window.set_size(PhysicalSize::new(safe.width, safe.height));
        let _ = window.set_position(PhysicalPosition::new(safe.x, safe.y));
        if safe != rect {
            state.update_record(&label, |r| r.rect = Some(safe));
        }
    }
    if record.always_on_top {
        let _ = window.set_always_on_top(true);
    }
    if record.maximized {
        let _ = window.maximize();
    }
    if label == MAIN_LABEL {
        // Tam ekran tercihi, pencere görünmeden hedef monitörde uygulanır (yanlış ekranda parlama olmaz).
        crate::display::apply_saved(&window.as_ref().window(), state);
        if state.start_hidden() {
            state.track(&label);
            return;
        }
    }
    let _ = window.show();
    let _ = window.set_focus();
    state.track(&label);
}

/// Pencere olaylarını dinleyip geometriyi günceller; kapanış davranışını yönetir.
pub fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    let app = window.app_handle();
    let Some(state) = app.try_state::<LayoutState>() else {
        return;
    };
    let label = window.label().to_string();

    match event {
        // Gömülü pencere kapsayıcıları ana pencereyi izler (konum, boyut, simge durumu, öne gelme).
        WindowEvent::Focused(true) => crate::embed::sync_window(window),
        WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
            crate::embed::sync_window(window);
            if !state.is_tracked(&label) {
                return;
            }
            // Küçültülmüş pencereler Windows'ta (-32000, -32000) bildirir; kaydetme.
            // Tam ekrandayken de kaydetme: pencere moduna dönüşte önceki boyut korunmalı.
            if window.is_minimized().unwrap_or(false) || window.is_fullscreen().unwrap_or(false) {
                return;
            }
            let maximized = window.is_maximized().unwrap_or(false);
            if maximized {
                state.update_record(&label, |r| r.maximized = true);
                return;
            }
            if let (Ok(pos), Ok(size)) = (window.outer_position(), window.inner_size()) {
                if size.width == 0 || size.height == 0 {
                    return;
                }
                state.update_record(&label, |r| {
                    r.maximized = false;
                    r.rect = Some(Rect::new(pos.x, pos.y, size.width, size.height));
                });
            }
        }
        WindowEvent::CloseRequested { api, .. } if label == MAIN_LABEL => {
            if state.close_to_tray() && !state.exiting.load(Ordering::SeqCst) {
                api.prevent_close();
                crate::embed::hide_window(window);
                let _ = window.hide();
            } else {
                quit(app);
            }
        }
        // Panel penceresi kapanmadan önce içine alınmış dış pencereleri bağımsız hâle getir.
        WindowEvent::CloseRequested { .. } => crate::embed::release_for_window(window),
        WindowEvent::Destroyed => {
            if state.exiting.load(Ordering::SeqCst) {
                return;
            }
            if let Some(panel) = panel_from_label(&label) {
                state.set_detached(panel, false);
                let _ = app.emit(LAYOUT_CHANGED_EVENT, state.snapshot());
            }
        }
        _ => {}
    }
}

/// Paneli ayrı pencerede açar; zaten açıksa öne getirir.
pub fn open_panel_window<R: Runtime>(app: &AppHandle<R>, panel: &str) -> Result<(), String> {
    let (_, title, width, height) =
        *panel_spec(panel).ok_or_else(|| format!("Bilinmeyen panel: {panel}"))?;
    let label = panel_label(panel);
    let state = app.state::<LayoutState>();

    if let Some(existing) = app.get_window(&label) {
        let _ = existing.unminimize();
        let _ = existing.show();
        let _ = existing.set_focus();
    } else {
        // Panel türü pencere etiketinden okunur (bkz. src/App.tsx); URL sorgusu gerekmez.
        let window = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
            .title(title)
            .inner_size(width, height)
            .min_inner_size(320.0, 240.0)
            .decorations(false)
            .shadow(true)
            // Windows'ta Tauri'nin dosya bırakma işleyicisi HTML5 sürükle-bırakı engeller.
            .disable_drag_drop_handler()
            .visible(false)
            .center()
            .build()
            .map_err(|e| format!("Pencere oluşturulamadı: {e}"))?;
        restore_and_show(&window, &state);
    }

    state.set_detached(panel, true);
    let _ = app.emit(LAYOUT_CHANGED_EVENT, state.snapshot());
    Ok(())
}

/// Ayrılmış panel penceresini kapatır. `dock` true ise panel ana düzene döner (ana pencere olayı dinler).
pub fn close_panel_window<R: Runtime>(app: &AppHandle<R>, panel: &str) -> Result<(), String> {
    panel_spec(panel).ok_or_else(|| format!("Bilinmeyen panel: {panel}"))?;
    let state = app.state::<LayoutState>();
    state.set_detached(panel, false);
    if let Some(window) = app.get_window(&panel_label(panel)) {
        crate::embed::release_for_window(&window);
        let _ = window.destroy();
    }
    let _ = app.emit(LAYOUT_CHANGED_EVENT, state.snapshot());
    Ok(())
}

pub fn show_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(main) = app.get_window(MAIN_LABEL) {
        let _ = main.unminimize();
        let _ = main.show();
        if let Some(state) = app.try_state::<LayoutState>() {
            crate::display::ensure(&main, &state);
        }
        let _ = main.set_focus();
        crate::embed::sync_window(&main);
    }
}

/// Pencere (veya içindeki bir alt pencere — WebView2, gömülü uygulama) ön planda mı?
/// `is_focused()` odak WebView2 alt penceresindeyken false döndüğü için Win32 ile bakılır.
fn is_foreground<R: Runtime>(window: &Window<R>) -> bool {
    #[cfg(windows)]
    {
        use ::windows::Win32::UI::WindowsAndMessaging::{GetAncestor, GetForegroundWindow, GA_ROOT};
        use ::windows::Win32::System::Threading::GetCurrentProcessId;
        use ::windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;
        let Ok(h) = window.hwnd() else { return false };
        unsafe {
            let fg = GetForegroundWindow();
            if fg.is_invalid() {
                return false;
            }
            if GetAncestor(fg, GA_ROOT).0 as isize == h.0 as isize {
                return true;
            }
            // Gömülü uygulama odaktaysa ön plandaki pencere Alpicim'in kapsayıcısıdır (aynı süreç).
            let mut pid = 0u32;
            GetWindowThreadProcessId(fg, Some(&mut pid));
            pid == GetCurrentProcessId()
        }
    }
    #[cfg(not(windows))]
    window.is_focused().unwrap_or(false)
}

/// Kısayol: ana pencere öndeyse gizler, değilse gösterip öne getirir.
pub fn toggle_main<R: Runtime>(app: &AppHandle<R>) {
    let Some(main) = app.get_window(MAIN_LABEL) else { return };
    let visible = main.is_visible().unwrap_or(false) && !main.is_minimized().unwrap_or(false);
    if visible && is_foreground(&main) {
        crate::embed::hide_window(&main);
        let _ = main.hide();
    } else {
        show_main(app);
    }
}

/// Düzeni kaydedip uygulamadan tamamen çıkar. Gömülü dış pencereler önce bağımsız hâle getirilir.
pub fn quit<R: Runtime>(app: &AppHandle<R>) {
    crate::embed::release_all();
    if let Some(state) = app.try_state::<LayoutState>() {
        state.exiting.store(true, Ordering::SeqCst);
        state.save_if_dirty();
    }
    app.exit(0);
}

// ---------------------------------------------------------------------------
// Webview'den çağrılan komutlar
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn layout_get(state: tauri::State<'_, LayoutState>) -> LayoutSnapshot {
    state.snapshot()
}

// Not: Windows'ta senkron komut içinde webview penceresi oluşturmak kilitlenmeye yol açar;
// bu yüzden pencere açan/kapatan komutlar async'tir (Tauri belgeleri: WebviewWindowBuilder::new).
#[tauri::command]
pub async fn panel_open_window<R: Runtime>(app: AppHandle<R>, panel: String) -> Result<(), String> {
    open_panel_window(&app, &panel)
}

#[tauri::command]
pub async fn panel_close_window<R: Runtime>(app: AppHandle<R>, panel: String) -> Result<(), String> {
    close_panel_window(&app, &panel)
}

#[tauri::command]
pub fn window_set_always_on_top<R: Runtime>(
    window: Window<R>,
    state: tauri::State<'_, LayoutState>,
    value: bool,
) -> Result<(), String> {
    window.set_always_on_top(value).map_err(|e| e.to_string())?;
    state.update_record(window.label(), |r| r.always_on_top = value);
    Ok(())
}

#[tauri::command]
pub fn layout_set_close_to_tray(state: tauri::State<'_, LayoutState>, value: bool) {
    state.with(|inner| {
        inner.file.close_to_tray = value;
        inner.dirty = true;
    });
}

#[tauri::command]
pub fn layout_set_start_hidden(state: tauri::State<'_, LayoutState>, value: bool) {
    state.with(|inner| {
        inner.file.start_hidden = value;
        inner.dirty = true;
    });
}

#[tauri::command]
pub fn app_quit<R: Runtime>(app: AppHandle<R>) {
    quit(&app);
}

/// Ana pencereyi gizler (tepside çalışmaya devam eder; kısayol veya tepsiyle geri gelir).
#[tauri::command]
pub fn app_hide_main<R: Runtime>(app: AppHandle<R>) {
    if let Some(main) = app.get_window(MAIN_LABEL) {
        crate::embed::hide_window(&main);
        let _ = main.hide();
    }
}
