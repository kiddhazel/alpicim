//! Boşta kalma süresi: son kullanıcı girdisinden beri geçen süre (GetLastInputInfo), 5 sn'de bir yayılır.
//! Yalnızca okur; girdi enjekte etmez.

use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};

const IDLE_EVENT: &str = "alpicim://idle";
#[cfg(windows)]
const POLL_SECS: u64 = 5;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct IdlePayload {
    idle_seconds: u64,
}

/// Son girdiden beri geçen milisaniye (GetTickCount 32 bit sarmalamasına dayanıklı).
#[cfg(windows)]
fn idle_millis() -> Option<u64> {
    use windows::Win32::System::SystemInformation::GetTickCount;
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    let mut info = LASTINPUTINFO {
        cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };
    unsafe {
        if !GetLastInputInfo(&mut info).as_bool() {
            return None;
        }
        Some(GetTickCount().wrapping_sub(info.dwTime) as u64)
    }
}

#[cfg(windows)]
pub fn spawn<R: Runtime>(app: AppHandle<R>) {
    std::thread::Builder::new()
        .name("alpicim-idle".into())
        .spawn(move || loop {
            std::thread::sleep(std::time::Duration::from_secs(POLL_SECS));
            if let Some(ms) = idle_millis() {
                let _ = app.emit(IDLE_EVENT, IdlePayload { idle_seconds: ms / 1000 });
            }
        })
        .ok();
}

#[cfg(not(windows))]
pub fn spawn<R: Runtime>(_app: AppHandle<R>) {}
