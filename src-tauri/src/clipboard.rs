//! Pano geçmişi: yalnızca metin (CF_UNICODETEXT).
//!
//! Ayrı bir iş parçacığında yalnız-ileti (message-only) penceresi oluşturulur ve
//! `AddClipboardFormatListener` ile pano değişiklikleri dinlenir. Her `WM_CLIPBOARDUPDATE` iletisinde metin okunur,
//! son `MAX_ENTRIES` kayıt bellekte tutulur ve `clipboard.json` dosyasına yazılır.
//!
//! Gizlilik: parola yöneticilerinin işaretlediği içerik ("ExcludeClipboardContentFromMonitorProcessing",
//! "Clipboard Viewer Ignore", "CanIncludeInClipboardHistory" = 0) kaydedilmez; 20 KB'tan büyük metinler atlanır;
//! kayıt istenirse duraklatılabilir. Panoya geri yazma da aynı iş parçacığında yapılır (pano sahibi pencere orada).

use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicIsize, AtomicU64, Ordering},
        Mutex,
    },
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime};

pub const CLIPBOARD_EVENT: &str = "alpicim://clipboard";
/// Tutulan en fazla kayıt (sabitlenenler dahil; sabitlenenler taşmada silinmez).
pub const MAX_ENTRIES: usize = 100;
/// Bundan büyük metinler kaydedilmez (UTF-8 bayt).
pub const MAX_BYTES: usize = 20 * 1024;
const FILE_NAME: &str = "clipboard.json";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClipEntry {
    pub id: String,
    pub text: String,
    /// Son kopyalanma zamanı (Unix ms).
    pub at: u64,
    #[serde(default)]
    pub pinned: bool,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Persisted {
    #[serde(default)]
    entries: Vec<ClipEntry>,
    #[serde(default)]
    paused: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipSnapshot {
    pub entries: Vec<ClipEntry>,
    pub paused: bool,
    /// Dinleyici çalışıyor mu (pencere oluşturulamadıysa false).
    pub available: bool,
}

// ---------------------------------------------------------------------------------------------
// Saf kısım (birim testli)
// ---------------------------------------------------------------------------------------------

/// Metin kaydedilmeye uygun mu: boş/yalnız boşluk değil ve boyut sınırı içinde.
pub fn acceptable(text: &str) -> bool {
    !text.trim().is_empty() && text.len() <= MAX_BYTES
}

/// Yeni metni listenin başına ekler. Aynı metin varsa yeni kayıt açılmaz, mevcut kayıt başa taşınır.
/// Liste değiştiyse true döner.
pub fn push_entry(list: &mut Vec<ClipEntry>, text: &str, now: u64, id: String) -> bool {
    if !acceptable(text) {
        return false;
    }
    if let Some(pos) = list.iter().position(|e| e.text == text) {
        let mut entry = list.remove(pos);
        let changed = pos != 0 || entry.at != now;
        entry.at = now;
        list.insert(0, entry);
        return changed;
    }
    list.insert(0, ClipEntry { id, text: text.to_string(), at: now, pinned: false });
    trim(list);
    true
}

/// Sınırı aşan en eski sabitlenmemiş kayıtları siler.
pub fn trim(list: &mut Vec<ClipEntry>) {
    while list.len() > MAX_ENTRIES {
        match list.iter().rposition(|e| !e.pinned) {
            Some(i) => {
                list.remove(i);
            }
            None => break,
        }
    }
}

/// Dosyadan okunan listeyi doğrular: geçersiz, yinelenen (kimlik veya metin) kayıtları atar.
pub fn sanitize(list: Vec<ClipEntry>) -> Vec<ClipEntry> {
    let mut out: Vec<ClipEntry> = Vec::new();
    for e in list {
        if e.id.is_empty() || e.id.len() > 64 || !acceptable(&e.text) {
            continue;
        }
        if out.iter().any(|o| o.id == e.id || o.text == e.text) {
            continue;
        }
        out.push(e);
    }
    trim(&mut out);
    out
}

/// Parola yöneticisi işaretleri: içerik geçmişe alınmamalı mı?
pub fn is_excluded(exclude_flag: bool, viewer_ignore: bool, can_include: Option<u32>) -> bool {
    exclude_flag || viewer_ignore || can_include == Some(0)
}

/// Kısa, kararlı biçimli kimlik.
fn new_id(now: u64, counter: u64) -> String {
    format!("c{now:x}{counter:x}")
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

// ---------------------------------------------------------------------------------------------
// Durum
// ---------------------------------------------------------------------------------------------

pub struct ClipboardState {
    data: Mutex<Persisted>,
    path: PathBuf,
    /// Dinleyici penceresi (0: çalışmıyor).
    hwnd: AtomicIsize,
    counter: AtomicU64,
}

impl ClipboardState {
    pub fn load(config_dir: PathBuf) -> Self {
        let path = config_dir.join(FILE_NAME);
        let data = std::fs::read(&path)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<Persisted>(&bytes).ok())
            .map(|p| Persisted { entries: sanitize(p.entries), paused: p.paused })
            .unwrap_or_default();
        Self { data: Mutex::new(data), path, hwnd: AtomicIsize::new(0), counter: AtomicU64::new(0) }
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Persisted> {
        self.data.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn snapshot(&self) -> ClipSnapshot {
        let d = self.lock();
        ClipSnapshot { entries: d.entries.clone(), paused: d.paused, available: self.hwnd.load(Ordering::SeqCst) != 0 }
    }

    fn paused(&self) -> bool {
        self.lock().paused
    }

    fn save(&self) {
        let bytes = match serde_json::to_vec(&*self.lock()) {
            Ok(b) => b,
            Err(_) => return,
        };
        let tmp = self.path.with_extension("json.tmp");
        if std::fs::write(&tmp, bytes).is_ok() {
            let _ = std::fs::rename(&tmp, &self.path);
        }
    }

    /// Değişikliği uygular; değiştiyse dosyaya yazar ve olay yayınlar.
    fn mutate<R: Runtime>(&self, app: &AppHandle<R>, f: impl FnOnce(&mut Persisted) -> bool) -> ClipSnapshot {
        let changed = f(&mut self.lock());
        if changed {
            self.save();
            let _ = app.emit(CLIPBOARD_EVENT, self.snapshot());
        }
        self.snapshot()
    }

    fn record<R: Runtime>(&self, app: &AppHandle<R>, text: &str) {
        let n = self.counter.fetch_add(1, Ordering::SeqCst);
        let now = now_ms();
        self.mutate(app, |d| push_entry(&mut d.entries, text, now, new_id(now, n)));
    }

    fn text_of(&self, id: &str) -> Option<String> {
        self.lock().entries.iter().find(|e| e.id == id).map(|e| e.text.clone())
    }
}

// ---------------------------------------------------------------------------------------------
// Windows: dinleyici iş parçacığı
// ---------------------------------------------------------------------------------------------

#[cfg(windows)]
mod imp {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Mutex;
    use std::time::Duration;

    use tauri::{AppHandle, Manager, Runtime};
    use windows::core::w;
    use windows::Win32::Foundation::{HANDLE, HGLOBAL, HINSTANCE, HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::DataExchange::{
        AddClipboardFormatListener, CloseClipboard, EmptyClipboard, GetClipboardData, IsClipboardFormatAvailable,
        OpenClipboard, RegisterClipboardFormatW, SetClipboardData,
    };
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalSize, GlobalUnlock, GMEM_MOVEABLE};
    use windows::Win32::System::Threading::GetCurrentThreadId;
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, PeekMessageW, PostThreadMessageW, RegisterClassW,
        HWND_MESSAGE, MSG, PM_NOREMOVE, WINDOW_EX_STYLE, WINDOW_STYLE, WM_APP, WNDCLASSW,
    };

    use super::{is_excluded, ClipboardState, MAX_BYTES};

    const CF_UNICODETEXT: u32 = 13;
    const WM_CLIPBOARDUPDATE: u32 = 0x031D;
    const WM_RUN_JOBS: u32 = WM_APP + 11;
    const CLASS_NAME: windows::core::PCWSTR = w!("AlpicimClipboardListener");

    type Job = Box<dyn FnOnce(HWND) + Send>;
    static JOBS: Mutex<Vec<Job>> = Mutex::new(Vec::new());
    static THREAD_ID: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
    /// Pencere yordamı → döngü: pano değişti.
    static CHANGED: AtomicBool = AtomicBool::new(false);

    unsafe extern "system" fn listener_proc(h: HWND, msg: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
        if msg == WM_CLIPBOARDUPDATE {
            CHANGED.store(true, Ordering::SeqCst);
            return LRESULT(0);
        }
        DefWindowProcW(h, msg, wp, lp)
    }

    /// Panoyu açar (başka bir uygulama tutuyorsa kısa aralıklarla yeniden dener).
    unsafe fn open(owner: HWND) -> bool {
        for _ in 0..8 {
            if OpenClipboard(Some(owner)).is_ok() {
                return true;
            }
            std::thread::sleep(Duration::from_millis(25));
        }
        false
    }

    unsafe fn format_present(name: windows::core::PCWSTR) -> bool {
        let id = RegisterClipboardFormatW(name);
        id != 0 && IsClipboardFormatAvailable(id).is_ok()
    }

    /// "CanIncludeInClipboardHistory" biçimindeki DWORD değeri (yoksa None).
    unsafe fn can_include() -> Option<u32> {
        let id = RegisterClipboardFormatW(w!("CanIncludeInClipboardHistory"));
        if id == 0 || IsClipboardFormatAvailable(id).is_err() {
            return None;
        }
        let h = GetClipboardData(id).ok()?;
        let g = HGLOBAL(h.0);
        if GlobalSize(g) < 4 {
            return Some(0);
        }
        let p = GlobalLock(g) as *const u32;
        if p.is_null() {
            return Some(0);
        }
        let v = p.read_unaligned();
        let _ = GlobalUnlock(g);
        Some(v)
    }

    /// Panodaki metni okur; parola yöneticisi işaretliyse veya metin yoksa None.
    unsafe fn read_text(owner: HWND) -> Option<String> {
        if !open(owner) {
            return None;
        }
        let result = (|| {
            let excluded = is_excluded(
                format_present(w!("ExcludeClipboardContentFromMonitorProcessing")),
                format_present(w!("Clipboard Viewer Ignore")),
                can_include(),
            );
            if excluded || IsClipboardFormatAvailable(CF_UNICODETEXT).is_err() {
                return None;
            }
            let h = GetClipboardData(CF_UNICODETEXT).ok()?;
            let g = HGLOBAL(h.0);
            let units = GlobalSize(g) / 2;
            // UTF-16 → UTF-8 en fazla 3 kat büyür; açıkça büyük olanları hiç kopyalama.
            if units == 0 || units > MAX_BYTES * 2 {
                return None;
            }
            let p = GlobalLock(g) as *const u16;
            if p.is_null() {
                return None;
            }
            let slice = std::slice::from_raw_parts(p, units);
            let len = slice.iter().position(|&c| c == 0).unwrap_or(units);
            let text = String::from_utf16_lossy(&slice[..len]);
            let _ = GlobalUnlock(g);
            Some(text)
        })();
        let _ = CloseClipboard();
        result
    }

    /// Metni panoya yazar (dinleyici iş parçacığında çağrılmalı: pano sahibi bu pencere).
    unsafe fn write_text(owner: HWND, text: &str) -> Result<(), String> {
        let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
        if !open(owner) {
            return Err("Pano başka bir uygulama tarafından kullanılıyor".into());
        }
        let result = (|| {
            EmptyClipboard().map_err(|e| e.to_string())?;
            let g = GlobalAlloc(GMEM_MOVEABLE, wide.len() * 2).map_err(|e| e.to_string())?;
            let p = GlobalLock(g) as *mut u16;
            if p.is_null() {
                let _ = windows::Win32::Foundation::GlobalFree(Some(g));
                return Err("Bellek ayrılamadı".to_string());
            }
            std::ptr::copy_nonoverlapping(wide.as_ptr(), p, wide.len());
            let _ = GlobalUnlock(g);
            if let Err(e) = SetClipboardData(CF_UNICODETEXT, Some(HANDLE(g.0))) {
                let _ = windows::Win32::Foundation::GlobalFree(Some(g));
                return Err(e.to_string());
            }
            Ok(())
        })();
        let _ = CloseClipboard();
        result
    }

    pub fn spawn<R: Runtime>(app: AppHandle<R>) {
        let _ = std::thread::Builder::new().name("alpicim-clipboard".into()).spawn(move || unsafe {
            let mut msg = MSG::default();
            let _ = PeekMessageW(&mut msg, None, 0, 0, PM_NOREMOVE);
            THREAD_ID.store(GetCurrentThreadId(), Ordering::SeqCst);
            let instance = GetModuleHandleW(None).map(|m| HINSTANCE(m.0)).unwrap_or_default();
            let class = WNDCLASSW {
                lpfnWndProc: Some(listener_proc),
                hInstance: instance,
                lpszClassName: CLASS_NAME,
                ..Default::default()
            };
            RegisterClassW(&class);
            let hwnd = match CreateWindowExW(
                WINDOW_EX_STYLE(0),
                CLASS_NAME,
                w!("Alpicim pano"),
                WINDOW_STYLE(0),
                0,
                0,
                0,
                0,
                Some(HWND_MESSAGE),
                None,
                Some(instance),
                None,
            ) {
                Ok(h) => h,
                Err(err) => {
                    eprintln!("Pano dinleyicisi oluşturulamadı: {err}");
                    return;
                }
            };
            if let Err(err) = AddClipboardFormatListener(hwnd) {
                eprintln!("Pano dinlenemiyor: {err}");
                return;
            }
            let state = app.state::<ClipboardState>();
            state.hwnd.store(hwnd.0 as isize, Ordering::SeqCst);

            loop {
                let r = GetMessageW(&mut msg, None, 0, 0);
                if r.0 <= 0 {
                    break;
                }
                if msg.message == WM_RUN_JOBS && msg.hwnd.is_invalid() {
                    let jobs: Vec<Job> = JOBS.lock().unwrap_or_else(|e| e.into_inner()).drain(..).collect();
                    for job in jobs {
                        job(hwnd);
                    }
                } else {
                    DispatchMessageW(&msg);
                }
                if CHANGED.swap(false, Ordering::SeqCst) && !state.paused() {
                    if let Some(text) = read_text(hwnd) {
                        state.record(&app, &text);
                    }
                }
            }
        });
    }

    /// İşlevi dinleyici iş parçacığında çalıştırır ve sonucu bekler (en fazla 3 sn).
    fn on_thread<T: Send + 'static>(f: impl FnOnce(HWND) -> T + Send + 'static) -> Result<T, String> {
        let tid = THREAD_ID.load(Ordering::SeqCst);
        if tid == 0 {
            return Err("Pano dinleyicisi çalışmıyor".into());
        }
        let (tx, rx) = std::sync::mpsc::channel();
        JOBS.lock().unwrap_or_else(|e| e.into_inner()).push(Box::new(move |h| {
            let _ = tx.send(f(h));
        }));
        unsafe {
            PostThreadMessageW(tid, WM_RUN_JOBS, WPARAM(0), LPARAM(0)).map_err(|e| e.to_string())?;
        }
        rx.recv_timeout(Duration::from_secs(3)).map_err(|_| "Pano yanıt vermiyor".to_string())
    }

    pub fn set_text(text: String) -> Result<(), String> {
        on_thread(move |h| unsafe { write_text(h, &text) })?
    }
}

#[cfg(windows)]
pub fn spawn<R: Runtime>(app: AppHandle<R>) {
    imp::spawn(app);
}

#[cfg(not(windows))]
pub fn spawn<R: Runtime>(_app: AppHandle<R>) {}

#[cfg(windows)]
fn set_text(text: String) -> Result<(), String> {
    imp::set_text(text)
}

#[cfg(not(windows))]
fn set_text(_text: String) -> Result<(), String> {
    Err("Yalnızca Windows'ta desteklenir".into())
}

// ---------------------------------------------------------------------------------------------
// Komutlar
// ---------------------------------------------------------------------------------------------

#[tauri::command]
pub fn clipboard_list(state: tauri::State<'_, ClipboardState>) -> ClipSnapshot {
    state.snapshot()
}

/// Kaydı panoya geri yazar (dinleyici onu listenin başına taşır).
#[tauri::command]
pub async fn clipboard_copy<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    let text = app.state::<ClipboardState>().text_of(&id).ok_or("Kayıt bulunamadı")?;
    tauri::async_runtime::spawn_blocking(move || set_text(text)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn clipboard_delete<R: Runtime>(app: AppHandle<R>, id: String) -> ClipSnapshot {
    let state = app.state::<ClipboardState>();
    state.mutate(&app, |d| {
        let before = d.entries.len();
        d.entries.retain(|e| e.id != id);
        d.entries.len() != before
    })
}

/// Sabitlenmemiş tüm kayıtları siler.
#[tauri::command]
pub fn clipboard_clear<R: Runtime>(app: AppHandle<R>) -> ClipSnapshot {
    let state = app.state::<ClipboardState>();
    state.mutate(&app, |d| {
        let before = d.entries.len();
        d.entries.retain(|e| e.pinned);
        d.entries.len() != before
    })
}

#[tauri::command]
pub fn clipboard_set_paused<R: Runtime>(app: AppHandle<R>, paused: bool) -> ClipSnapshot {
    let state = app.state::<ClipboardState>();
    state.mutate(&app, |d| {
        let changed = d.paused != paused;
        d.paused = paused;
        changed
    })
}

#[tauri::command]
pub fn clipboard_pin<R: Runtime>(app: AppHandle<R>, id: String, pinned: bool) -> ClipSnapshot {
    let state = app.state::<ClipboardState>();
    state.mutate(&app, |d| match d.entries.iter_mut().find(|e| e.id == id) {
        Some(e) if e.pinned != pinned => {
            e.pinned = pinned;
            true
        }
        _ => false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(id: &str, text: &str, pinned: bool) -> ClipEntry {
        ClipEntry { id: id.into(), text: text.into(), at: 1, pinned }
    }

    #[test]
    fn push_adds_to_front_and_dedupes() {
        let mut list = Vec::new();
        assert!(push_entry(&mut list, "a", 1, "1".into()));
        assert!(push_entry(&mut list, "b", 2, "2".into()));
        assert_eq!(list.iter().map(|e| e.text.as_str()).collect::<Vec<_>>(), ["b", "a"]);
        // Aynı metin: yeni kayıt yok, mevcut kayıt (kimliğiyle) başa taşınır.
        assert!(push_entry(&mut list, "a", 3, "3".into()));
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].id, "1");
        assert_eq!(list[0].at, 3);
    }

    #[test]
    fn push_skips_blank_and_huge() {
        let mut list = Vec::new();
        assert!(!push_entry(&mut list, "   \n\t", 1, "1".into()));
        assert!(!push_entry(&mut list, &"x".repeat(MAX_BYTES + 1), 1, "2".into()));
        assert!(push_entry(&mut list, &"x".repeat(MAX_BYTES), 1, "3".into()));
        assert_eq!(list.len(), 1);
    }

    #[test]
    fn trim_keeps_pinned() {
        let mut list: Vec<ClipEntry> = (0..MAX_ENTRIES).map(|i| entry(&format!("{i}"), &format!("t{i}"), i == MAX_ENTRIES - 1)).collect();
        assert!(push_entry(&mut list, "new", 5, "n".into()));
        assert_eq!(list.len(), MAX_ENTRIES);
        // En eski kayıt sabitli olduğu için silinmedi; ondan önceki sabitsiz kayıt silindi.
        assert!(list.iter().any(|e| e.id == format!("{}", MAX_ENTRIES - 1)));
        assert!(!list.iter().any(|e| e.id == format!("{}", MAX_ENTRIES - 2)));
    }

    #[test]
    fn sanitize_drops_invalid_and_duplicates() {
        let list = vec![entry("1", "a", false), entry("1", "b", false), entry("2", "a", false), entry("", "c", false), entry("3", " ", false), entry("4", "d", true)];
        let out = sanitize(list);
        assert_eq!(out.iter().map(|e| e.id.as_str()).collect::<Vec<_>>(), ["1", "4"]);
    }

    #[test]
    fn password_manager_flags_exclude() {
        assert!(!is_excluded(false, false, None));
        assert!(!is_excluded(false, false, Some(1)));
        assert!(is_excluded(false, false, Some(0)));
        assert!(is_excluded(true, false, None));
        assert!(is_excluded(false, true, Some(1)));
    }
}
