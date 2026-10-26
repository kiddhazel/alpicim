//! Sistem çapında klavye kısayolları (uygulama gizliyken de çalışır).
//!
//! Win32 `RegisterHotKey` kullanılır; kısayollar kendi ileti döngüsü olan ayrı bir iş parçacığında kaydedilir.
//! Ek bağımlılık gerekmez. Başka bir program aynı kısayolu tuttuysa kayıt başarısız olur ve hata arayüzde gösterilir.

use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU32, Ordering},
        Mutex,
    },
    time::Duration,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::windows::LayoutState;

pub const PALETTE_EVENT: &str = "alpicim://palette";

/// (eylem, varsayılan kısayol)
pub const ACTIONS: &[(&str, &str)] = &[
    ("toggleVisible", "Ctrl+Alt+Space"),
    ("toggleFullscreen", "Ctrl+Alt+F"),
    ("palette", "Ctrl+Alt+K"),
    ("quickSearch", "Alt+Space"),
    ("quickClipboard", "Ctrl+Shift+V"),
];

const MOD_ALT: u32 = 0x0001;
const MOD_CONTROL: u32 = 0x0002;
const MOD_SHIFT: u32 = 0x0004;
const MOD_WIN: u32 = 0x0008;
const MOD_NOREPEAT: u32 = 0x4000;
const WM_RELOAD: u32 = 0x8000 + 1; // WM_APP + 1

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Accel {
    pub mods: u32,
    pub vk: u32,
}

fn key_code(key: &str) -> Option<u32> {
    let k = key.to_ascii_uppercase();
    if k.len() == 1 {
        let c = k.as_bytes()[0];
        if c.is_ascii_uppercase() || c.is_ascii_digit() {
            return Some(c as u32);
        }
    }
    if let Some(n) = k.strip_prefix('F').and_then(|n| n.parse::<u32>().ok()) {
        if (1..=24).contains(&n) {
            return Some(0x70 + n - 1);
        }
    }
    Some(match k.as_str() {
        "SPACE" => 0x20,
        "ENTER" => 0x0D,
        "TAB" => 0x09,
        "ESC" | "ESCAPE" => 0x1B,
        "LEFT" => 0x25,
        "UP" => 0x26,
        "RIGHT" => 0x27,
        "DOWN" => 0x28,
        "HOME" => 0x24,
        "END" => 0x23,
        "PAGEUP" => 0x21,
        "PAGEDOWN" => 0x22,
        "INSERT" => 0x2D,
        "DELETE" => 0x2E,
        _ => return None,
    })
}

/// "Ctrl+Alt+F" biçimindeki kısayolu çözer. Yazmayı engellememek için Ctrl, Alt veya Win şarttır.
pub fn parse_accelerator(text: &str) -> Result<Accel, String> {
    let mut mods = 0;
    let mut vk = None;
    for part in text.split('+').map(str::trim).filter(|p| !p.is_empty()) {
        match part.to_ascii_lowercase().as_str() {
            "ctrl" | "control" => mods |= MOD_CONTROL,
            "alt" => mods |= MOD_ALT,
            "shift" => mods |= MOD_SHIFT,
            "win" | "super" | "meta" => mods |= MOD_WIN,
            _ => {
                if vk.is_some() {
                    return Err(format!("Birden fazla tuş: {text}"));
                }
                vk = Some(key_code(part).ok_or_else(|| format!("Desteklenmeyen tuş: {part}"))?);
            }
        }
    }
    let vk = vk.ok_or_else(|| format!("Tuş eksik: {text}"))?;
    if mods & (MOD_CONTROL | MOD_ALT | MOD_WIN) == 0 {
        return Err("Kısayolda Ctrl, Alt veya Win bulunmalı".into());
    }
    Ok(Accel { mods, vk })
}

/// Kayıtlı bağlamalar + varsayılanlar. Boş metin = kısayol kapalı.
pub fn effective(saved: &HashMap<String, String>) -> Vec<(String, String)> {
    ACTIONS
        .iter()
        .map(|(action, default)| {
            let value = saved.get(*action).cloned().unwrap_or_else(|| (*default).to_string());
            ((*action).to_string(), value)
        })
        .collect()
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutStatus {
    pub action: String,
    pub accelerator: String,
    pub default_accelerator: String,
    /// Kayıt hatası (ör. başka bir program bu kısayolu kullanıyor).
    pub error: Option<String>,
}

#[derive(Default)]
pub struct HotkeyState {
    thread_id: AtomicU32,
    errors: Mutex<HashMap<String, String>>,
}

impl HotkeyState {
    fn statuses(&self, saved: &HashMap<String, String>) -> Vec<ShortcutStatus> {
        let errors = self.errors.lock().unwrap_or_else(|e| e.into_inner());
        effective(saved)
            .into_iter()
            .map(|(action, accelerator)| ShortcutStatus {
                default_accelerator: ACTIONS
                    .iter()
                    .find(|(a, _)| *a == action)
                    .map(|(_, d)| (*d).to_string())
                    .unwrap_or_default(),
                error: errors.get(&action).cloned(),
                action,
                accelerator,
            })
            .collect()
    }
}

fn dispatch<R: Runtime>(app: &AppHandle<R>, action: &str) {
    match action {
        "toggleVisible" => crate::windows::toggle_main(app),
        "toggleFullscreen" => {
            if let Err(err) = crate::display::toggle_fullscreen(app) {
                eprintln!("Tam ekran değiştirilemedi: {err}");
            }
        }
        "palette" => {
            crate::windows::show_main(app);
            let _ = app.emit(PALETTE_EVENT, ());
        }
        "quickSearch" => crate::quick::show(app, "search"),
        "quickClipboard" => crate::quick::show(app, "clipboard"),
        _ => {}
    }
}

/// Kısayol iş parçacığını başlatır.
#[cfg(windows)]
pub fn spawn<R: Runtime>(app: AppHandle<R>) {
    use windows::Win32::System::Threading::GetCurrentThreadId;
    use windows::Win32::UI::Input::KeyboardAndMouse::{RegisterHotKey, UnregisterHotKey, HOT_KEY_MODIFIERS};
    use windows::Win32::UI::WindowsAndMessaging::{GetMessageW, PeekMessageW, MSG, PM_NOREMOVE, WM_HOTKEY};

    std::thread::spawn(move || unsafe {
        let mut msg = MSG::default();
        // İleti kuyruğunun oluşması için (PostThreadMessage öncesi gerekli).
        let _ = PeekMessageW(&mut msg, None, 0, 0, PM_NOREMOVE);
        let Some(state) = app.try_state::<HotkeyState>() else { return };
        state.thread_id.store(GetCurrentThreadId(), Ordering::SeqCst);

        let mut registered: Vec<(i32, String)> = Vec::new();
        let register_all = |registered: &mut Vec<(i32, String)>| {
            for (id, _) in registered.drain(..) {
                let _ = UnregisterHotKey(None, id);
            }
            let saved = app.state::<LayoutState>().shortcuts();
            let mut errors = HashMap::new();
            for (i, (action, accel)) in effective(&saved).into_iter().enumerate() {
                if accel.trim().is_empty() {
                    continue;
                }
                let id = i as i32 + 1;
                match parse_accelerator(&accel) {
                    Ok(a) => match RegisterHotKey(None, id, HOT_KEY_MODIFIERS(a.mods | MOD_NOREPEAT), a.vk) {
                        Ok(()) => registered.push((id, action)),
                        Err(_) => {
                            errors.insert(action, "Kısayol başka bir program tarafından kullanılıyor".to_string());
                        }
                    },
                    Err(e) => {
                        errors.insert(action, e);
                    }
                }
            }
            *state.errors.lock().unwrap_or_else(|e| e.into_inner()) = errors;
        };
        register_all(&mut registered);

        loop {
            let r = GetMessageW(&mut msg, None, 0, 0);
            if r.0 <= 0 {
                break;
            }
            if msg.message == WM_HOTKEY {
                let id = msg.wParam.0 as i32;
                if let Some((_, action)) = registered.iter().find(|(i, _)| *i == id) {
                    dispatch(&app, action);
                }
            } else if msg.message == WM_RELOAD {
                register_all(&mut registered);
            }
        }
    });
}

#[cfg(not(windows))]
pub fn spawn<R: Runtime>(_app: AppHandle<R>) {}

#[tauri::command]
pub fn shortcuts_get(state: tauri::State<'_, HotkeyState>, layout: tauri::State<'_, LayoutState>) -> Vec<ShortcutStatus> {
    state.statuses(&layout.shortcuts())
}

/// Kısayolları doğrular, kaydeder ve yeniden kaydettirir. Boş metin kısayolu kapatır.
#[tauri::command]
pub async fn shortcuts_set<R: Runtime>(app: AppHandle<R>, bindings: HashMap<String, String>) -> Result<Vec<ShortcutStatus>, String> {
    let mut clean = HashMap::new();
    for (action, accel) in bindings {
        if !ACTIONS.iter().any(|(a, _)| *a == action) {
            return Err(format!("Bilinmeyen eylem: {action}"));
        }
        let accel = accel.trim().to_string();
        if !accel.is_empty() {
            parse_accelerator(&accel)?;
        }
        clean.insert(action, accel);
    }
    let values: Vec<&String> = clean.values().filter(|v| !v.is_empty()).collect();
    for (i, v) in values.iter().enumerate() {
        if values[i + 1..].iter().any(|o| o.eq_ignore_ascii_case(v)) {
            return Err(format!("Aynı kısayol iki eyleme atanamaz: {v}"));
        }
    }
    let layout = app.state::<LayoutState>();
    layout.set_shortcuts(clean);
    let state = app.state::<HotkeyState>();
    let tid = state.thread_id.load(Ordering::SeqCst);
    #[cfg(windows)]
    if tid != 0 {
        use windows::Win32::Foundation::{LPARAM, WPARAM};
        use windows::Win32::UI::WindowsAndMessaging::PostThreadMessageW;
        unsafe {
            let _ = PostThreadMessageW(tid, WM_RELOAD, WPARAM(0), LPARAM(0));
        }
    }
    // Kayıt sonucunun (hata/başarı) iş parçacığından gelmesi için kısa bekleme.
    tokio_sleep(Duration::from_millis(200)).await;
    Ok(state.statuses(&layout.shortcuts()))
}

async fn tokio_sleep(d: Duration) {
    // Tauri'nin async çalışma zamanı tokio'dur; ayrı bağımlılık eklememek için sarmalayıcı kullanılır.
    tauri::async_runtime::spawn_blocking(move || std::thread::sleep(d)).await.ok();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_common_accelerators() {
        assert_eq!(parse_accelerator("Ctrl+Alt+F"), Ok(Accel { mods: MOD_CONTROL | MOD_ALT, vk: 0x46 }));
        assert_eq!(parse_accelerator("ctrl + shift + space"), Ok(Accel { mods: MOD_CONTROL | MOD_SHIFT, vk: 0x20 }));
        assert_eq!(parse_accelerator("Win+F12").map(|a| a.vk), Ok(0x7B));
        assert_eq!(parse_accelerator("Alt+1").map(|a| a.vk), Ok(0x31));
    }

    #[test]
    fn rejects_unsafe_or_invalid() {
        assert!(parse_accelerator("F").is_err());
        assert!(parse_accelerator("Shift+A").is_err());
        assert!(parse_accelerator("Ctrl+Alt").is_err());
        assert!(parse_accelerator("Ctrl+A+B").is_err());
        assert!(parse_accelerator("Ctrl+Ğ").is_err());
    }

    #[test]
    fn defaults_fill_missing_actions() {
        let mut saved = HashMap::new();
        saved.insert("palette".to_string(), String::new());
        let eff = effective(&saved);
        assert_eq!(eff.len(), ACTIONS.len());
        assert_eq!(eff.iter().find(|(a, _)| a == "palette").map(|(_, v)| v.as_str()), Some(""));
        assert_eq!(eff.iter().find(|(a, _)| a == "toggleFullscreen").map(|(_, v)| v.as_str()), Some("Ctrl+Alt+F"));
    }
}
