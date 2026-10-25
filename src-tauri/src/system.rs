//! Sistem bilgileri ve Windows entegrasyonları:
//! - CPU / RAM / disk kullanımı (Win32: GetSystemTimes, GlobalMemoryStatusEx, GetDiskFreeSpaceExW)
//! - Windows açılışında başlatma (HKCU\…\Run kaydı; yönetici yetkisi gerekmez)
//! - Sistem medya oturumu (SMTC): çalan parça bilgisi ve oynat/duraklat/sonraki/önceki.
//!   Bu, Windows'un resmî medya API'sidir; YouTube Music (WebView2), Spotify, tarayıcılar vb. burada görünür.

use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemStats {
    /// 0–100; ilk ölçümde iki örnek arasında kısa bekleme yapılır.
    pub cpu: Option<f64>,
    pub memory_used: u64,
    pub memory_total: u64,
    pub disk_name: String,
    pub disk_used: u64,
    pub disk_total: u64,
}

/// İki CPU zaman örneğinden kullanım yüzdesi. Saf fonksiyon (birim testli).
pub fn cpu_usage(prev: (u64, u64), now: (u64, u64)) -> Option<f64> {
    let (idle0, total0) = prev;
    let (idle1, total1) = now;
    let total = total1.checked_sub(total0)?;
    let idle = idle1.checked_sub(idle0)?;
    if total == 0 || idle > total {
        return None;
    }
    Some(((total - idle) as f64 / total as f64 * 100.0).clamp(0.0, 100.0))
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSession {
    pub app_id: String,
    /// Kaynağı Alpicim mi (ör. YouTube Music paneli)?
    pub own: bool,
    pub title: String,
    pub artist: String,
    pub album: String,
    /// "playing" | "paused" | "stopped" | "changing" | "closed" | "opened"
    pub status: String,
    pub can_play_pause: bool,
    pub can_next: bool,
    pub can_previous: bool,
    /// Parçadaki konum (ms) — Windows'un son güncellediği andaki değer; uygulama bildirmezse `None`.
    pub position_ms: Option<u64>,
    /// Parça süresi (ms).
    pub duration_ms: Option<u64>,
    /// Konumun güncellendiği an (Unix ms). Çalarken güncel konum = position + (şimdi − updated).
    pub updated_at_ms: Option<i64>,
}

/// WinRT TimeSpan (100 ns) → ms. Negatif/sıfır süre yok sayılır.
pub fn ticks_to_ms(ticks: i64) -> Option<u64> {
    (ticks > 0).then(|| (ticks / 10_000) as u64)
}

/// WinRT DateTime (1601'den beri 100 ns) → Unix ms.
pub fn datetime_to_unix_ms(universal: i64) -> Option<i64> {
    const EPOCH_DIFF: i64 = 116_444_736_000_000_000;
    (universal > EPOCH_DIFF).then(|| (universal - EPOCH_DIFF) / 10_000)
}

#[cfg(windows)]
mod imp {
    use std::sync::Mutex;

    use windows::core::HSTRING;
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession as Session,
        GlobalSystemMediaTransportControlsSessionManager as SessionManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
    };
    use windows::Win32::Foundation::FILETIME;
    use windows::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER,
        KEY_QUERY_VALUE, KEY_SET_VALUE, REG_SZ,
    };
    use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
    use windows::Win32::System::Threading::GetSystemTimes;

    use super::{cpu_usage, datetime_to_unix_ms, ticks_to_ms, MediaSession, SystemStats};

    static LAST_CPU: Mutex<Option<(u64, u64)>> = Mutex::new(None);

    fn ft(f: FILETIME) -> u64 {
        ((f.dwHighDateTime as u64) << 32) | f.dwLowDateTime as u64
    }

    fn cpu_sample() -> Option<(u64, u64)> {
        let (mut idle, mut kernel, mut user) = (FILETIME::default(), FILETIME::default(), FILETIME::default());
        unsafe { GetSystemTimes(Some(&mut idle), Some(&mut kernel), Some(&mut user)).ok()? };
        // Çekirdek süresi boşta geçen süreyi de içerir.
        Some((ft(idle), ft(kernel) + ft(user)))
    }

    pub fn stats() -> SystemStats {
        let now = cpu_sample();
        let prev = { *LAST_CPU.lock().unwrap_or_else(|e| e.into_inner()) };
        let cpu = match (prev, now) {
            (Some(p), Some(n)) => cpu_usage(p, n),
            (None, Some(first)) => {
                std::thread::sleep(std::time::Duration::from_millis(300));
                let second = cpu_sample();
                if let Some(s) = second {
                    *LAST_CPU.lock().unwrap_or_else(|e| e.into_inner()) = Some(s);
                }
                second.and_then(|s| cpu_usage(first, s))
            }
            _ => None,
        };
        if prev.is_some() {
            *LAST_CPU.lock().unwrap_or_else(|e| e.into_inner()) = now;
        }

        let mut mem = MEMORYSTATUSEX { dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32, ..Default::default() };
        let (memory_used, memory_total) = if unsafe { GlobalMemoryStatusEx(&mut mem) }.is_ok() {
            (mem.ullTotalPhys.saturating_sub(mem.ullAvailPhys), mem.ullTotalPhys)
        } else {
            (0, 0)
        };

        let drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into());
        let root = HSTRING::from(format!("{drive}\\"));
        let (mut free, mut total) = (0u64, 0u64);
        let ok = unsafe { GetDiskFreeSpaceExW(&root, None, Some(&mut total), Some(&mut free)) }.is_ok();
        SystemStats {
            cpu,
            memory_used,
            memory_total,
            disk_name: drive,
            disk_used: if ok { total.saturating_sub(free) } else { 0 },
            disk_total: if ok { total } else { 0 },
        }
    }

    // --- Windows açılışında başlatma -------------------------------------------------

    const RUN_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const VALUE: &str = "Alpicim";

    fn open_run(access: windows::Win32::System::Registry::REG_SAM_FLAGS) -> Result<HKEY, String> {
        let mut key = HKEY::default();
        let r = unsafe { RegOpenKeyExW(HKEY_CURRENT_USER, &HSTRING::from(RUN_KEY), None, access, &mut key) };
        if r.is_ok() {
            Ok(key)
        } else {
            Err(format!("Kayıt defteri açılamadı ({})", r.0))
        }
    }

    pub fn autostart_enabled() -> bool {
        let Ok(key) = open_run(KEY_QUERY_VALUE) else { return false };
        let r = unsafe { RegQueryValueExW(key, &HSTRING::from(VALUE), None, None, None, None) };
        unsafe {
            let _ = RegCloseKey(key);
        }
        r.is_ok()
    }

    pub fn set_autostart(enabled: bool) -> Result<(), String> {
        let key = open_run(KEY_SET_VALUE)?;
        let result = if enabled {
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let command = format!("\"{}\"", exe.display());
            let wide: Vec<u16> = command.encode_utf16().chain(std::iter::once(0)).collect();
            let bytes: Vec<u8> = wide.iter().flat_map(|w| w.to_le_bytes()).collect();
            unsafe { RegSetValueExW(key, &HSTRING::from(VALUE), None, REG_SZ, Some(&bytes)) }
        } else {
            unsafe { RegDeleteValueW(key, &HSTRING::from(VALUE)) }
        };
        unsafe {
            let _ = RegCloseKey(key);
        }
        // Silerken değer zaten yoksa (ERROR_FILE_NOT_FOUND = 2) sorun değil.
        if result.is_ok() || (!enabled && result.0 == 2) {
            Ok(())
        } else {
            Err(format!("Kayıt defterine yazılamadı ({})", result.0))
        }
    }

    // --- Sistem medya oturumu (SMTC) ------------------------------------------------

    fn status_name(s: Status) -> &'static str {
        match s {
            Status::Playing => "playing",
            Status::Paused => "paused",
            Status::Stopped => "stopped",
            Status::Changing => "changing",
            Status::Opened => "opened",
            _ => "closed",
        }
    }

    /// YouTube Music paneli WebView2'de çalıştığı için Windows oturumu "msedgewebview2" kimliğiyle açar
    /// (uygulama içinde doğrulandı). Başka WebView2 uygulamaları da aynı kimliği kullanabilir; bu yüzden
    /// "kendi oturumu" seçimi yalnızca tercih sırasını etkiler, uydurma bilgi üretmez.
    fn is_own(app_id: &str) -> bool {
        let id = app_id.to_ascii_lowercase();
        id.contains("alpicim") || id.contains("msedgewebview2")
    }

    fn describe(session: &Session) -> windows::core::Result<MediaSession> {
        let app_id = session.SourceAppUserModelId()?.to_string();
        let props = session.TryGetMediaPropertiesAsync()?.join()?;
        let info = session.GetPlaybackInfo()?;
        let controls = info.Controls()?;
        let timeline = session.GetTimelineProperties().ok();
        Ok(MediaSession {
            own: is_own(&app_id),
            app_id,
            title: props.Title()?.to_string(),
            artist: props.Artist()?.to_string(),
            album: props.AlbumTitle()?.to_string(),
            status: status_name(info.PlaybackStatus()?).to_string(),
            can_play_pause: controls.IsPlayPauseToggleEnabled()?,
            can_next: controls.IsNextEnabled()?,
            can_previous: controls.IsPreviousEnabled()?,
            position_ms: timeline.as_ref().and_then(|t| t.Position().ok()).and_then(|p| ticks_to_ms(p.Duration).or(Some(0))),
            duration_ms: timeline.as_ref().and_then(|t| t.EndTime().ok()).and_then(|e| ticks_to_ms(e.Duration)),
            updated_at_ms: timeline
                .as_ref()
                .and_then(|t| t.LastUpdatedTime().ok())
                .and_then(|d| datetime_to_unix_ms(d.UniversalTime)),
        })
    }

    fn manager() -> Result<SessionManager, String> {
        SessionManager::RequestAsync()
            .and_then(|op| op.join())
            .map_err(|e| format!("Medya oturumları okunamadı: {e}"))
    }

    fn all_sessions(mgr: &SessionManager) -> Vec<Session> {
        let mut out = Vec::new();
        if let Ok(list) = mgr.GetSessions() {
            let n = list.Size().unwrap_or(0);
            for i in 0..n {
                if let Ok(s) = list.GetAt(i) {
                    out.push(s);
                }
            }
        }
        out
    }

    /// Alpicim'in oturumu varsa o, yoksa Windows'un "geçerli" oturumu.
    fn pick(mgr: &SessionManager, prefer_own: bool) -> Option<Session> {
        if prefer_own {
            if let Some(own) = all_sessions(mgr)
                .into_iter()
                .find(|s| s.SourceAppUserModelId().map(|id| is_own(&id.to_string())).unwrap_or(false))
            {
                return Some(own);
            }
        }
        mgr.GetCurrentSession().ok()
    }

    pub fn media_sessions() -> Result<Vec<MediaSession>, String> {
        let mgr = manager()?;
        let current = mgr.GetCurrentSession().ok().and_then(|s| s.SourceAppUserModelId().ok()).map(|h| h.to_string());
        let mut list: Vec<MediaSession> = all_sessions(&mgr).iter().filter_map(|s| describe(s).ok()).collect();
        // Geçerli oturum en başta.
        list.sort_by_key(|m| Some(&m.app_id) != current.as_ref());
        Ok(list)
    }

    pub fn media_command(action: &str, prefer_own: bool) -> Result<bool, String> {
        let mgr = manager()?;
        let session = pick(&mgr, prefer_own).ok_or("Çalan bir medya oturumu yok")?;
        let op = match action {
            "playPause" => session.TryTogglePlayPauseAsync(),
            "next" => session.TrySkipNextAsync(),
            "previous" => session.TrySkipPreviousAsync(),
            _ => return Err("Bilinmeyen medya komutu".into()),
        };
        op.and_then(|o| o.join()).map_err(|e| format!("Komut gönderilemedi: {e}"))
    }
}

#[tauri::command]
pub async fn system_stats() -> Result<SystemStats, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(imp::stats).await.map_err(|e| e.to_string())
    }
    #[cfg(not(windows))]
    Err("Yalnızca Windows'ta desteklenir".into())
}

#[tauri::command]
pub async fn autostart_get() -> bool {
    #[cfg(windows)]
    {
        imp::autostart_enabled()
    }
    #[cfg(not(windows))]
    false
}

#[tauri::command]
pub async fn autostart_set(enabled: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        imp::set_autostart(enabled)
    }
    #[cfg(not(windows))]
    {
        let _ = enabled;
        Err("Yalnızca Windows'ta desteklenir".into())
    }
}

/// Sistemdeki medya oturumları (geçerli oturum ilk sırada).
#[tauri::command]
pub async fn media_sessions() -> Result<Vec<MediaSession>, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(imp::media_sessions).await.map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    Err("Yalnızca Windows'ta desteklenir".into())
}

/// "playPause" | "next" | "previous". `preferOwn`: Alpicim'in (YouTube Music) oturumunu hedefle.
#[tauri::command]
pub async fn media_command(action: String, prefer_own: Option<bool>) -> Result<bool, String> {
    #[cfg(windows)]
    {
        let own = prefer_own.unwrap_or(true);
        tauri::async_runtime::spawn_blocking(move || imp::media_command(&action, own))
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    {
        let _ = (action, prefer_own);
        Err("Yalnızca Windows'ta desteklenir".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_winrt_time_values() {
        assert_eq!(ticks_to_ms(1_234_5678), Some(1234));
        assert_eq!(ticks_to_ms(0), None);
        // 1970-01-01T00:00:01Z
        assert_eq!(datetime_to_unix_ms(116_444_736_010_000_000), Some(1000));
        assert_eq!(datetime_to_unix_ms(0), None);
    }

    #[test]
    fn computes_cpu_usage_from_samples() {
        assert_eq!(cpu_usage((100, 1000), (150, 1100)), Some(50.0));
        assert_eq!(cpu_usage((100, 1000), (200, 1100)), Some(0.0));
        assert_eq!(cpu_usage((100, 1000), (100, 1000)), None);
        // Sayaç geriye gittiyse (ör. uyku) ölçüm yok sayılır.
        assert_eq!(cpu_usage((500, 1000), (100, 900)), None);
    }
}
