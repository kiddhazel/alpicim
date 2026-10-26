//! Ses mikseri: Windows Core Audio (varsayılan çıkış aygıtı) — uygulama başına ses düzeyi/sessize alma ve ana ses.
//! Oturumlar uygulama (exe yolu) başına birleştirilir; ayar o uygulamanın tüm oturumlarına uygulanır.

use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

/// Ana ses düzeyi için sabit kimlik; sistem sesleri için "system".
pub const MASTER_ID: &str = "master";
pub const SYSTEM_ID: &str = "system";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MixerSession {
    pub id: String,
    pub name: String,
    pub exe: Option<String>,
    pub volume: f32,
    pub muted: bool,
    pub system: bool,
    /// Şu an ses çıkarıyor mu?
    pub active: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MixerState {
    pub master: f32,
    pub master_muted: bool,
    pub sessions: Vec<MixerSession>,
}

/// 0..1 aralığına sıkıştırır; NaN → None. Saf fonksiyon (testli).
pub fn clamp_volume(v: f32) -> Option<f32> {
    v.is_finite().then(|| v.clamp(0.0, 1.0))
}

/// Exe yolundan görünen ad: dosya adı (uzantısız), ilk harf büyük.
pub fn display_name(exe: &str) -> String {
    let stem = std::path::Path::new(exe).file_stem().and_then(|s| s.to_str()).unwrap_or(exe);
    let mut chars = stem.chars();
    match chars.next() {
        Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

/// Oturum kimliği: küçük harfli exe yolu.
pub fn session_id(exe: &str) -> String {
    exe.to_lowercase()
}

#[cfg(windows)]
mod win {
    use super::*;
    use windows::core::{Interface, PWSTR};
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{
        eMultimedia, eRender, AudioSessionStateActive, AudioSessionStateExpired, IAudioSessionControl2,
        IAudioSessionManager2, IMMDevice, IMMDeviceEnumerator, ISimpleAudioVolume, MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
    };

    pub fn init() {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }
    }

    fn device() -> Result<IMMDevice, String> {
        unsafe {
            let e: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
            e.GetDefaultAudioEndpoint(eRender, eMultimedia).map_err(|e| e.to_string())
        }
    }

    fn endpoint() -> Result<IAudioEndpointVolume, String> {
        unsafe { device()?.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None).map_err(|e| e.to_string()) }
    }

    fn exe_of(pid: u32) -> Option<String> {
        unsafe {
            let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
            let mut buf = vec![0u16; 1024];
            let mut len = buf.len() as u32;
            let r = QueryFullProcessImageNameW(h, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len);
            let _ = CloseHandle(h);
            r.ok()?;
            Some(String::from_utf16_lossy(&buf[..len as usize]))
        }
    }

    struct Entry {
        key: String,
        exe: Option<String>,
        system: bool,
        active: bool,
        vol: ISimpleAudioVolume,
    }

    fn entries() -> Result<Vec<Entry>, String> {
        unsafe {
            let mgr = device()?
                .Activate::<IAudioSessionManager2>(CLSCTX_ALL, None)
                .map_err(|e| e.to_string())?;
            let en = mgr.GetSessionEnumerator().map_err(|e| e.to_string())?;
            let count = en.GetCount().map_err(|e| e.to_string())?;
            let mut out = Vec::new();
            for i in 0..count {
                let Ok(ctl) = en.GetSession(i) else { continue };
                let Ok(state) = ctl.GetState() else { continue };
                if state == AudioSessionStateExpired {
                    continue;
                }
                let Ok(ctl2) = ctl.cast::<IAudioSessionControl2>() else { continue };
                let Ok(vol) = ctl.cast::<ISimpleAudioVolume>() else { continue };
                let system = ctl2.IsSystemSoundsSession().is_ok();
                // S_FALSE de bir Ok döndürür; yalnızca S_OK sistem sesleridir.
                let system = system && ctl2.IsSystemSoundsSession().0 == 0;
                let (key, exe) = if system {
                    (SYSTEM_ID.to_string(), None)
                } else {
                    let pid = ctl2.GetProcessId().unwrap_or(0);
                    if pid == 0 {
                        continue;
                    }
                    let Some(exe) = exe_of(pid) else { continue };
                    (session_id(&exe), Some(exe))
                };
                out.push(Entry { key, exe, system, active: state == AudioSessionStateActive, vol });
            }
            Ok(out)
        }
    }

    pub fn list() -> Result<MixerState, String> {
        init();
        let ep = endpoint()?;
        let (master, master_muted) = unsafe {
            (
                ep.GetMasterVolumeLevelScalar().map_err(|e| e.to_string())?,
                ep.GetMute().map(|b| b.as_bool()).unwrap_or(false),
            )
        };
        let mut sessions: Vec<MixerSession> = Vec::new();
        for e in entries()? {
            let (volume, muted) = unsafe {
                (e.vol.GetMasterVolume().unwrap_or(1.0), e.vol.GetMute().map(|b| b.as_bool()).unwrap_or(false))
            };
            if let Some(existing) = sessions.iter_mut().find(|s| s.id == e.key) {
                existing.active |= e.active;
                continue;
            }
            let name = e.exe.as_deref().map(display_name).unwrap_or_default();
            sessions.push(MixerSession {
                id: e.key,
                name,
                exe: e.exe,
                volume,
                muted,
                system: e.system,
                active: e.active,
            });
        }
        sessions.sort_by(|a, b| {
            b.active
                .cmp(&a.active)
                .then(a.system.cmp(&b.system))
                .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });
        Ok(MixerState { master, master_muted, sessions })
    }

    pub fn set_volume(id: &str, volume: f32) -> Result<(), String> {
        init();
        unsafe {
            if id == MASTER_ID {
                return endpoint()?
                    .SetMasterVolumeLevelScalar(volume, std::ptr::null())
                    .map_err(|e| e.to_string());
            }
            let mut found = false;
            for e in entries()?.into_iter().filter(|e| e.key == id) {
                e.vol.SetMasterVolume(volume, std::ptr::null()).map_err(|e| e.to_string())?;
                found = true;
            }
            if found { Ok(()) } else { Err("Oturum bulunamadı".into()) }
        }
    }

    pub fn set_mute(id: &str, muted: bool) -> Result<(), String> {
        init();
        unsafe {
            if id == MASTER_ID {
                return endpoint()?.SetMute(muted, std::ptr::null()).map_err(|e| e.to_string());
            }
            let mut found = false;
            for e in entries()?.into_iter().filter(|e| e.key == id) {
                e.vol.SetMute(muted, std::ptr::null()).map_err(|e| e.to_string())?;
                found = true;
            }
            if found { Ok(()) } else { Err("Oturum bulunamadı".into()) }
        }
    }
}

#[tauri::command]
pub async fn mixer_list() -> Result<MixerState, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(win::list).await.map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    {
        Err("Yalnızca Windows".into())
    }
}

#[tauri::command]
pub async fn mixer_set_volume(id: String, volume: f32) -> Result<(), String> {
    let volume = clamp_volume(volume).ok_or("Geçersiz ses düzeyi")?;
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || win::set_volume(&id, volume))
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    {
        let _ = (id, volume);
        Err("Yalnızca Windows".into())
    }
}

#[tauri::command]
pub async fn mixer_set_mute(id: String, muted: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || win::set_mute(&id, muted))
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    {
        let _ = (id, muted);
        Err("Yalnızca Windows".into())
    }
}

/// Uygulama exe'sinin simgesi (PNG data URL, önbellekli). Yalnızca mutlak, var olan `.exe` yolları.
#[tauri::command]
pub async fn mixer_icon<R: Runtime>(app: AppHandle<R>, exe: String) -> Result<Option<String>, String> {
    let p = PathBuf::from(&exe);
    let is_exe = p.extension().and_then(|e| e.to_str()).is_some_and(|e| e.eq_ignore_ascii_case("exe"));
    if !p.is_absolute() || !is_exe || !p.exists() {
        return Ok(None);
    }
    let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || crate::scanner::icon_data_url(&cache, &p))
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn volume_is_clamped() {
        assert_eq!(clamp_volume(1.5), Some(1.0));
        assert_eq!(clamp_volume(-0.2), Some(0.0));
        assert_eq!(clamp_volume(0.4), Some(0.4));
        assert_eq!(clamp_volume(f32::NAN), None);
    }

    #[test]
    fn names_and_ids() {
        assert_eq!(display_name(r"C:\Program Files\Spotify\spotify.exe"), "Spotify");
        assert_eq!(session_id(r"C:\A\B.EXE"), r"c:\a\b.exe");
    }
}
