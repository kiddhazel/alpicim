//! Dış Windows uygulama pencerelerini panellere yerleştirme (deneysel).
//!
//! Yöntem: hedef pencerenin stilleri kaydedilir, başlık/kenarlık stilleri kaldırılıp `WS_CHILD` eklenir ve
//! `SetParent` ile Alpicim penceresinin alt penceresi yapılır. Konum/boyut React panelinin alanına göre
//! `SetWindowPos` ile güncellenir. Ayırırken her şey kaydedilen değerlere geri alınır.
//!
//! Güvenlik ve kararlılık sınırları:
//! - DLL/kod enjeksiyonu, bellek değişikliği yoktur; yalnızca belgelenmiş pencere API'leri kullanılır.
//! - Yönetici olarak çalışan, sistem/kabuk, UWP çerçeve ve erişilemeyen pencereler reddedilir.
//! - Herhangi bir adım başarısız olursa yapılan değişiklikler geri alınır.
//! - Uygulama düzgün kapanırken (çıkış, panel kapatma, panik) tüm pencereler bağımsız hâle getirilir.
//!   Alpicim zorla sonlandırılırsa (Görev Yöneticisi) Windows alt pencereleri ebeveynle birlikte yok
//!   edebilir; bu durumda gömülü uygulamanın penceresi kapanabilir. Bu risk README'de belgelenmiştir.
//! - Yalnızca bu modülün kaydettiği pencereler taşınabilir/odaklanabilir; webview keyfî HWND'yi yönetemez.

use serde::Serialize;

/// Arayüze gönderilen pencere bilgisi.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowInfo {
    /// HWND değeri (sayı). Yalnızca bu oturumda geçerlidir.
    pub hwnd: i64,
    pub title: String,
    pub process_name: String,
    pub exe_path: String,
    pub pid: u32,
    pub class_name: String,
    pub embeddable: bool,
    /// Gömülemiyorsa nedeni.
    pub reason: Option<String>,
}

/// Paneli olmayan, kabuk veya sistem pencereleri (sınıf adı).
const BLOCKED_CLASSES: &[&str] = &[
    "Progman",
    "WorkerW",
    "Shell_TrayWnd",
    "Shell_SecondaryTrayWnd",
    "Windows.UI.Core.CoreWindow",
    "Shell_InputSwitchTopLevelWindow",
    "NotifyIconOverflowWindow",
    "TaskManagerWindow",
];

const BLOCKED_PROCESSES: &[&str] = &[
    "searchhost.exe",
    "startmenuexperiencehost.exe",
    "shellexperiencehost.exe",
    "textinputhost.exe",
    "lockapp.exe",
    "applicationframehost.exe",
    "taskmgr.exe",
    "msedgewebview2.exe",
];

/// Saf sınıflandırma: pencere gömülemiyorsa kullanıcıya gösterilecek nedeni döndürür.
pub fn classify(class_name: &str, process_name: &str, exe_path: &str, accessible: bool) -> Option<&'static str> {
    if !accessible {
        return Some("Yönetici olarak çalışıyor ya da erişilemiyor");
    }
    // Store (MSIX) paketleri çoğunlukla WinUI/UWP'dir. Win11 Not Defteri ile doğrulandı: alt pencere yapılınca
    // kendi penceresini kapatıyor. Bu yüzden güvenli tarafta kalıp hiç dokunmuyoruz.
    if exe_path.to_ascii_lowercase().contains("\\windowsapps\\") {
        return Some("Microsoft Store uygulaması — gömülünce kapanabiliyor, desteklenmiyor");
    }
    if class_name == "ApplicationFrameWindow" {
        return Some("Microsoft Store (UWP) çerçeve penceresi desteklenmiyor");
    }
    if BLOCKED_CLASSES.contains(&class_name) {
        return Some("Sistem penceresi");
    }
    let process = process_name.to_ascii_lowercase();
    if BLOCKED_PROCESSES.contains(&process.as_str()) {
        return Some("Sistem bileşeni");
    }
    if process == "explorer.exe" && class_name != "CabinetWClass" {
        return Some("Windows kabuğu penceresi");
    }
    None
}

#[cfg(windows)]
mod imp {
    use std::sync::Mutex;

    use windows::core::{BOOL, PWSTR};
    use windows::Win32::Foundation::{CloseHandle, COLORREF, HANDLE, HINSTANCE, HWND, LPARAM, LRESULT, POINT, WPARAM};
    use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
    use windows::Win32::Graphics::Gdi::{ClientToScreen, CreateSolidBrush};
    use windows::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::System::Threading::{
        GetCurrentProcessId, GetCurrentThreadId, OpenProcess, OpenProcessToken, QueryFullProcessImageNameW,
        PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::Input::KeyboardAndMouse::SetFocus;
    use windows::Win32::UI::WindowsAndMessaging::*;

    use super::{classify, WindowInfo};

    /// Gömmeden önceki durum: geri alma için gereken her şey.
    #[derive(Clone)]
    struct Saved {
        style: isize,
        ex_style: isize,
        placement: WINDOWPLACEMENT,
    }

    struct Embedded {
        hwnd: isize,
        /// Alpicim penceresi (ana pencere veya panel penceresi); konum buna göre hesaplanır.
        host: isize,
        /// Dış pencerenin gerçek ebeveyni: embed iş parçacığına ait kenarlıksız kapsayıcı.
        container: isize,
        pid: u32,
        saved: Saved,
        /// Ana pencerenin istemci alanına göre fiziksel konum.
        rel: Bounds,
        /// Panel bu pencerenin görünmesini istiyor mu (etkin sekme, katman yok)?
        wanted: bool,
    }

    // HWND ham işaretçi olduğu için Send değildir; kayıtta sayı olarak tutulur.
    unsafe impl Send for Embedded {}

    /// Panik kancasından da erişilebilmesi için genel kayıt.
    static REGISTRY: Mutex<Vec<Embedded>> = Mutex::new(Vec::new());

    /// Bu süreçte en az bir kez gömülmüş pencereler. Yeni açılışta kayıtlı sekmeler otomatik gömülmez
    /// (kullanıcı onayı gerekir); aynı oturumda panel yeniden açılınca otomatik gömülebilir.
    static SESSION: Mutex<Vec<isize>> = Mutex::new(Vec::new());

    pub fn known_in_session(target: i64) -> bool {
        SESSION.lock().unwrap_or_else(|e| e.into_inner()).contains(&(target as isize))
    }

    fn registry() -> std::sync::MutexGuard<'static, Vec<Embedded>> {
        REGISTRY.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn hwnd(v: isize) -> HWND {
        HWND(v as *mut core::ffi::c_void)
    }

    fn wide_to_string(buf: &[u16], len: usize) -> String {
        String::from_utf16_lossy(&buf[..len.min(buf.len())])
    }

    fn window_text(h: HWND) -> String {
        let mut buf = [0u16; 512];
        let n = unsafe { GetWindowTextW(h, &mut buf) };
        wide_to_string(&buf, n.max(0) as usize)
    }

    fn class_name(h: HWND) -> String {
        let mut buf = [0u16; 256];
        let n = unsafe { GetClassNameW(h, &mut buf) };
        wide_to_string(&buf, n.max(0) as usize)
    }

    fn pid_of(h: HWND) -> (u32, u32) {
        let mut pid = 0u32;
        let tid = unsafe { GetWindowThreadProcessId(h, Some(&mut pid)) };
        (pid, tid)
    }

    /// (exe yolu, erişilebilir mi). Yükseltilmiş süreçlerin belirteci (token) okunamaz → erişilemez.
    fn process_info(pid: u32) -> (String, bool) {
        unsafe {
            let Ok(process) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
                return (String::new(), false);
            };
            let mut buf = [0u16; 1024];
            let mut len = buf.len() as u32;
            let path = if QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len).is_ok() {
                wide_to_string(&buf, len as usize)
            } else {
                String::new()
            };
            let mut accessible = false;
            let mut token = HANDLE::default();
            if OpenProcessToken(process, TOKEN_QUERY, &mut token).is_ok() {
                let mut elevation = TOKEN_ELEVATION::default();
                let mut ret = 0u32;
                let ok = GetTokenInformation(
                    token,
                    TokenElevation,
                    Some(&mut elevation as *mut _ as *mut core::ffi::c_void),
                    std::mem::size_of::<TOKEN_ELEVATION>() as u32,
                    &mut ret,
                )
                .is_ok();
                // Kendimiz yükseltilmemişken yükseltilmiş süreç UIPI nedeniyle yönetilemez.
                accessible = ok && (elevation.TokenIsElevated == 0 || self_elevated());
                let _ = CloseHandle(token);
            }
            let _ = CloseHandle(process);
            (path, accessible)
        }
    }

    fn self_elevated() -> bool {
        use std::sync::OnceLock;
        static ELEVATED: OnceLock<bool> = OnceLock::new();
        *ELEVATED.get_or_init(|| unsafe {
            let mut token = HANDLE::default();
            let process = windows::Win32::System::Threading::GetCurrentProcess();
            if OpenProcessToken(process, TOKEN_QUERY, &mut token).is_err() {
                return false;
            }
            let mut elevation = TOKEN_ELEVATION::default();
            let mut ret = 0u32;
            let ok = GetTokenInformation(
                token,
                TokenElevation,
                Some(&mut elevation as *mut _ as *mut core::ffi::c_void),
                std::mem::size_of::<TOKEN_ELEVATION>() as u32,
                &mut ret,
            )
            .is_ok();
            let _ = CloseHandle(token);
            ok && elevation.TokenIsElevated != 0
        })
    }

    fn is_cloaked(h: HWND) -> bool {
        let mut cloaked = 0u32;
        unsafe {
            DwmGetWindowAttribute(h, DWMWA_CLOAKED, &mut cloaked as *mut _ as *mut core::ffi::c_void, 4).is_ok()
                && cloaked != 0
        }
    }

    fn is_top_level(h: HWND) -> bool {
        unsafe { GetAncestor(h, GA_PARENT) == GetDesktopWindow() }
    }

    fn describe(h: HWND) -> Option<WindowInfo> {
        unsafe {
            if !IsWindowVisible(h).as_bool() || !is_top_level(h) || is_cloaked(h) {
                return None;
            }
            if GetWindow(h, GW_OWNER).is_ok_and(|o| !o.is_invalid()) {
                return None;
            }
            let ex = GetWindowLongPtrW(h, GWL_EXSTYLE) as u32;
            if ex & WS_EX_TOOLWINDOW.0 != 0 {
                return None;
            }
            let title = window_text(h);
            if title.trim().is_empty() {
                return None;
            }
            let (pid, _) = pid_of(h);
            if pid == GetCurrentProcessId() {
                return None;
            }
            let class = class_name(h);
            let (exe, accessible) = process_info(pid);
            let process_name = exe.rsplit(['\\', '/']).next().unwrap_or("").to_string();
            let reason = classify(&class, &process_name, &exe, accessible);
            Some(WindowInfo {
                hwnd: h.0 as isize as i64,
                title,
                process_name,
                exe_path: exe,
                pid,
                class_name: class,
                embeddable: reason.is_none(),
                reason: reason.map(str::to_string),
            })
        }
    }

    unsafe extern "system" fn enum_proc(h: HWND, lparam: LPARAM) -> BOOL {
        let list = &mut *(lparam.0 as *mut Vec<WindowInfo>);
        if let Some(info) = describe(h) {
            list.push(info);
        }
        BOOL(1)
    }

    /// Görev çubuğunda görünen türden üst düzey pencereleri listeler (Z sırasıyla).
    pub fn list() -> Vec<WindowInfo> {
        let mut out: Vec<WindowInfo> = Vec::new();
        unsafe {
            let _ = EnumWindows(Some(enum_proc), LPARAM(&mut out as *mut _ as isize));
        }
        out
    }

    pub fn info(h: i64) -> Option<WindowInfo> {
        let h = hwnd(h as isize);
        if unsafe { !IsWindow(Some(h)).as_bool() } {
            return None;
        }
        describe(h)
    }

    pub fn foreground_foreign() -> Option<WindowInfo> {
        unsafe {
            let fg = GetForegroundWindow();
            if fg.is_invalid() {
                return None;
            }
            let root = GetAncestor(fg, GA_ROOT);
            let (pid, _) = pid_of(root);
            if pid == GetCurrentProcessId() {
                return None;
            }
            describe(root)
        }
    }

    /// Ana pencerenin istemci alanında fiziksel piksel (webview mantıksal pikseli × ölçek).
    #[derive(Clone, Copy, Debug, Default)]
    pub struct Bounds {
        pub x: i32,
        pub y: i32,
        pub width: i32,
        pub height: i32,
    }

    // -----------------------------------------------------------------------------------------
    // Kapsayıcı iş parçacığı
    //
    // Dış pencere doğrudan Tauri penceresinin içine alınmaz. Nedenleri (uygulama içinde doğrulandı):
    // - WebView2 DirectComposition ile çizildiği için aynı penceredeki klasik GDI alt pencereleri
    //   (ör. Karakter Eşlem) örtülüyor, görünmüyordu.
    // - Alt pencere ilişkisi giriş kuyruklarını birleştirir; gömülü Discord (Chromium) WebView2 ile aynı
    //   kuyruğu paylaşınca Alpicim'e fare girdisi ulaşmıyordu.
    // Bunun yerine her dış pencere, bu iş parçacığının sahip olduğu kenarlıksız bir üst düzey kapsayıcıya
    // alınır. Kapsayıcı ana pencerenin hemen üstünde, panelin konumunda tutulur. Böylece dış uygulamanın
    // giriş kuyruğu yalnızca bu iş parçacığına bağlanır; Tauri ana iş parçacığı ve WebView2 etkilenmez.
    // -----------------------------------------------------------------------------------------

    type Job = Box<dyn FnOnce() + Send>;
    static JOBS: Mutex<Vec<Job>> = Mutex::new(Vec::new());
    static HOST_TID: std::sync::OnceLock<u32> = std::sync::OnceLock::new();
    const WM_RUN_JOBS: u32 = WM_APP + 7;
    const CLASS_NAME: windows::core::PCWSTR = windows::core::w!("AlpicimEmbedContainer");

    unsafe extern "system" fn container_proc(h: HWND, msg: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
        match msg {
            // Alt+F4 / sistem menüsü kapsayıcıyı (ve içindeki dış uygulamayı) yok etmesin.
            WM_CLOSE => LRESULT(0),
            WM_SYSCOMMAND if (wp.0 & 0xFFF0) == SC_CLOSE as usize => LRESULT(0),
            // Kapsayıcı etkinleşince klavye odağı içindeki dış pencereye geçsin (aksi hâlde kapsayıcıda kalıyor;
            // Discord ile uygulama içinde doğrulandı).
            WM_SETFOCUS => {
                if let Ok(child) = GetWindow(h, GW_CHILD) {
                    if !child.is_invalid() {
                        let _ = SetFocus(Some(child));
                    }
                }
                LRESULT(0)
            }
            _ => DefWindowProcW(h, msg, wp, lp),
        }
    }

    fn host_thread() -> u32 {
        *HOST_TID.get_or_init(|| {
            let (tx, rx) = std::sync::mpsc::channel::<u32>();
            std::thread::Builder::new()
                .name("alpicim-embed".into())
                .spawn(move || unsafe {
                    let mut msg = MSG::default();
                    let _ = PeekMessageW(&mut msg, None, 0, 0, PM_NOREMOVE);
                    let instance = GetModuleHandleW(None).map(|m| HINSTANCE(m.0)).unwrap_or_default();
                    let class = WNDCLASSW {
                        lpfnWndProc: Some(container_proc),
                        hInstance: instance,
                        lpszClassName: CLASS_NAME,
                        // Uygulamanın koyu yüzey rengi (#11171f): dış pencere çizilene kadar beyaz parlama olmasın.
                        hbrBackground: CreateSolidBrush(COLORREF(0x001F1711)),
                        hCursor: LoadCursorW(None, IDC_ARROW).unwrap_or_default(),
                        ..Default::default()
                    };
                    RegisterClassW(&class);
                    let _ = tx.send(GetCurrentThreadId());
                    loop {
                        let r = GetMessageW(&mut msg, None, 0, 0);
                        if r.0 <= 0 {
                            break;
                        }
                        if msg.message == WM_RUN_JOBS && msg.hwnd.is_invalid() {
                            let jobs: Vec<Job> = JOBS.lock().unwrap_or_else(|e| e.into_inner()).drain(..).collect();
                            for job in jobs {
                                job();
                            }
                            continue;
                        }
                        let _ = TranslateMessage(&msg);
                        DispatchMessageW(&msg);
                    }
                })
                .expect("embed iş parçacığı başlatılamadı");
            rx.recv().unwrap_or(0)
        })
    }

    /// İşlevi kapsayıcı iş parçacığında çalıştırır ve sonucu bekler (en fazla 5 sn).
    fn on_host<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> Result<T, String> {
        let tid = host_thread();
        if tid == unsafe { GetCurrentThreadId() } {
            return Ok(f());
        }
        let (tx, rx) = std::sync::mpsc::channel();
        JOBS.lock().unwrap_or_else(|e| e.into_inner()).push(Box::new(move || {
            let _ = tx.send(f());
        }));
        unsafe {
            PostThreadMessageW(tid, WM_RUN_JOBS, WPARAM(0), LPARAM(0)).map_err(|e| e.to_string())?;
        }
        rx.recv_timeout(std::time::Duration::from_secs(5))
            .map_err(|_| "Gömülü uygulama yanıt vermiyor (5 sn)".to_string())
    }

    /// İşlevi kapsayıcı iş parçacığına gönderir, beklemez (ana iş parçacığı olay işleyicileri için).
    fn post_host(f: impl FnOnce() + Send + 'static) {
        let Some(&tid) = HOST_TID.get() else { return };
        JOBS.lock().unwrap_or_else(|e| e.into_inner()).push(Box::new(f));
        unsafe {
            let _ = PostThreadMessageW(tid, WM_RUN_JOBS, WPARAM(0), LPARAM(0));
        }
    }

    fn create_container() -> Result<isize, String> {
        unsafe {
            let instance = GetModuleHandleW(None).map(|m| HINSTANCE(m.0)).unwrap_or_default();
            CreateWindowExW(
                WS_EX_TOOLWINDOW,
                CLASS_NAME,
                windows::core::w!("Alpicim"),
                WS_POPUP | WS_CLIPCHILDREN | WS_CLIPSIBLINGS,
                0,
                0,
                10,
                10,
                None,
                None,
                Some(instance),
                None,
            )
            .map(|h| h.0 as isize)
            .map_err(|e| format!("Kapsayıcı pencere oluşturulamadı: {e}"))
        }
    }

    /// Ana pencere görünür ve simge durumunda değil mi?
    fn host_showing(host: HWND) -> bool {
        unsafe { IsWindowVisible(host).as_bool() && !IsIconic(host).as_bool() }
    }

    /// Kapsayıcıyı panelin ekran konumuna taşır; ana pencerenin hemen üstüne yerleştirir.
    fn layout(e: &Embedded) {
        unsafe {
            let host = hwnd(e.host);
            let container = hwnd(e.container);
            let target = hwnd(e.hwnd);
            if !e.wanted || !host_showing(host) || e.rel.width < 2 || e.rel.height < 2 {
                let _ = ShowWindow(container, SW_HIDE);
                return;
            }
            let mut origin = POINT { x: 0, y: 0 };
            let _ = ClientToScreen(host, &mut origin);
            // Z sırası: ana pencerenin hemen üstü (başka uygulamaların üstüne çıkmadan).
            let above = GetWindow(host, GW_HWNDPREV).ok().filter(|h| !h.is_invalid() && *h != container);
            let insert_after = above.unwrap_or(HWND_TOP);
            let _ = SetWindowPos(
                container,
                Some(insert_after),
                origin.x + e.rel.x,
                origin.y + e.rel.y,
                e.rel.width,
                e.rel.height,
                SWP_NOACTIVATE | SWP_SHOWWINDOW,
            );
            // Dış pencere kapsayıcıyı tamamen doldurur (ASYNC: uygulama yanıt vermezse beklenmez).
            let _ = SetWindowPos(
                target,
                None,
                0,
                0,
                e.rel.width,
                e.rel.height,
                SWP_NOACTIVATE | SWP_NOZORDER | SWP_SHOWWINDOW | SWP_ASYNCWINDOWPOS,
            );
        }
    }

    fn restore(e: &Embedded) {
        let h = hwnd(e.hwnd);
        unsafe {
            if IsWindow(Some(h)).as_bool() {
                // Belgelenen sıra: önce SetParent(NULL), sonra WS_CHILD kaldırılıp eski stil geri yüklenir.
                let _ = SetParent(h, None);
                SetWindowLongPtrW(h, GWL_STYLE, e.saved.style);
                SetWindowLongPtrW(h, GWL_EXSTYLE, e.saved.ex_style);
                let _ = SetWindowPlacement(h, &e.saved.placement);
                let _ = SetWindowPos(
                    h,
                    Some(HWND_TOP),
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED | SWP_SHOWWINDOW | SWP_ASYNCWINDOWPOS,
                );
            }
            // Kapsayıcı yalnızca kendi iş parçacığında yok edilebilir; panik yolunda başarısız olması zararsız.
            if GetCurrentThreadId() == HOST_TID.get().copied().unwrap_or(0) {
                let _ = DestroyWindow(hwnd(e.container));
            } else {
                let _ = ShowWindowAsync(hwnd(e.container), SW_HIDE);
            }
        }
    }

    /// Pencereyi `host` (Alpicim penceresi) üzerindeki panele yerleştirir. Zaten gömülüyse yeni konuma/pencereye taşır.
    pub fn embed(target: i64, host: isize, bounds: Bounds) -> Result<WindowInfo, String> {
        on_host(move || embed_on_host(target, host, bounds))?
    }

    fn embed_on_host(target: i64, host: isize, bounds: Bounds) -> Result<WindowInfo, String> {
        let h = hwnd(target as isize);
        unsafe {
            if !IsWindow(Some(h)).as_bool() {
                return Err("Pencere artık yok".into());
            }
            {
                let mut reg = registry();
                if let Some(e) = reg.iter_mut().find(|e| e.hwnd == target as isize) {
                    e.host = host;
                    e.rel = bounds;
                    e.wanted = true;
                    layout(e);
                    return Ok(WindowInfo {
                        hwnd: target,
                        title: window_text(h),
                        process_name: String::new(),
                        exe_path: String::new(),
                        pid: e.pid,
                        class_name: class_name(h),
                        embeddable: true,
                        reason: None,
                    });
                }
            }

            let info = describe(h).ok_or("Bu pencere yerleştirilemez (görünmüyor, sahipli veya Alpicim'e ait)")?;
            if let Some(reason) = &info.reason {
                return Err(reason.clone());
            }

            let style = GetWindowLongPtrW(h, GWL_STYLE);
            let ex_style = GetWindowLongPtrW(h, GWL_EXSTYLE);
            let mut placement = WINDOWPLACEMENT { length: std::mem::size_of::<WINDOWPLACEMENT>() as u32, ..Default::default() };
            GetWindowPlacement(h, &mut placement).map_err(|e| format!("Pencere durumu okunamadı: {e}"))?;
            // Simge durumundaki pencere panelden çıkınca küçültülmüş dönmesin: görünür (normal/büyütülmüş) geri gelsin.
            // (Discord ile uygulama içinde görüldü.)
            let saved_style = ((style as u32) & !WS_MINIMIZE.0) as isize;
            if placement.showCmd == SW_SHOWMINIMIZED.0 as u32 || placement.showCmd == SW_MINIMIZE.0 as u32 {
                placement.showCmd = if placement.flags.0 & WPF_RESTORETOMAXIMIZED.0 != 0 {
                    SW_SHOWMAXIMIZED.0 as u32
                } else {
                    SW_SHOWNORMAL.0 as u32
                };
            }
            let saved = Saved { style: saved_style, ex_style, placement };
            let container = create_container()?;
            let container_h = hwnd(container);

            if IsIconic(h).as_bool() || (style as u32) & WS_MAXIMIZE.0 != 0 {
                let _ = ShowWindow(h, SW_RESTORE);
            }

            let remove = WS_POPUP.0 | WS_CAPTION.0 | WS_THICKFRAME.0 | WS_SYSMENU.0 | WS_MINIMIZEBOX.0 | WS_MAXIMIZEBOX.0
                | WS_MAXIMIZE.0 | WS_MINIMIZE.0;
            let new_style = ((style as u32) & !remove) | WS_CHILD.0;
            let ex_remove = WS_EX_APPWINDOW.0 | WS_EX_WINDOWEDGE.0 | WS_EX_CLIENTEDGE.0 | WS_EX_DLGMODALFRAME.0 | WS_EX_TOPMOST.0;
            let new_ex = (ex_style as u32) & !ex_remove;

            SetWindowLongPtrW(h, GWL_STYLE, new_style as isize);
            SetWindowLongPtrW(h, GWL_EXSTYLE, new_ex as isize);

            let rollback = |why: String| -> Result<WindowInfo, String> {
                let _ = SetParent(h, None);
                SetWindowLongPtrW(h, GWL_STYLE, saved.style);
                SetWindowLongPtrW(h, GWL_EXSTYLE, saved.ex_style);
                let _ = SetWindowPlacement(h, &saved.placement);
                let _ = SetWindowPos(h, None, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED | SWP_ASYNCWINDOWPOS);
                let _ = DestroyWindow(container_h);
                Err(why)
            };

            if let Err(err) = SetParent(h, Some(container_h)) {
                return rollback(format!("Windows pencereyi taşımaya izin vermedi: {err}"));
            }
            if GetAncestor(h, GA_PARENT) != container_h {
                return rollback("Pencere yerleştirilemedi (uygulama ebeveyn değişikliğini geri aldı)".into());
            }
            let _ = SetWindowPos(h, None, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED | SWP_NOACTIVATE);

            let entry = Embedded { hwnd: target as isize, host, container, pid: info.pid, saved, rel: bounds, wanted: true };
            layout(&entry);
            registry().push(entry);
            {
                let mut s = SESSION.lock().unwrap_or_else(|e| e.into_inner());
                if !s.contains(&(target as isize)) {
                    s.push(target as isize);
                }
            }
            eprintln!("[embed] yerleştirildi: {} ({})", info.process_name, info.class_name);
            Ok(info)
        }
    }

    pub fn set_bounds(target: i64, bounds: Bounds, visible: bool) -> Result<(), String> {
        on_host(move || {
            let mut reg = registry();
            let e = reg.iter_mut().find(|e| e.hwnd == target as isize).ok_or("Pencere gömülü değil")?;
            if unsafe { !IsWindow(Some(hwnd(e.hwnd))).as_bool() } {
                return Err("Pencere kapandı".to_string());
            }
            e.rel = bounds;
            e.wanted = visible;
            layout(e);
            Ok(())
        })?
    }

    /// Ana pencere taşındı, boyutlandı, gizlendi/gösterildi veya öne geldi: kapsayıcıları yeniden hizala.
    pub fn sync_host(host: isize) {
        post_host(move || {
            let reg = registry();
            for e in reg.iter().filter(|e| e.host == host) {
                layout(e);
            }
        });
    }

    /// Ana pencere gizlenirken (tepsiye, kısayolla) kapsayıcıları hemen gizle.
    pub fn hide_host(host: isize) {
        post_host(move || {
            let reg = registry();
            for e in reg.iter().filter(|e| e.host == host) {
                unsafe {
                    let _ = ShowWindow(hwnd(e.container), SW_HIDE);
                }
            }
        });
    }

    /// Klavye odağını gömülü pencereye verir.
    pub fn focus(target: i64, _host: isize) -> Result<(), String> {
        on_host(move || {
            let reg = registry();
            let e = reg.iter().find(|e| e.hwnd == target as isize).ok_or("Pencere gömülü değil")?;
            unsafe {
                let _ = SetForegroundWindow(hwnd(e.container));
                // Dış pencere bu iş parçacığının kapsayıcısının çocuğu olduğu için giriş kuyrukları zaten bağlı.
                let _ = SetFocus(Some(hwnd(e.hwnd)));
            }
            Ok(())
        })?
    }

    /// Pencereyi panelden çıkarıp eski durumuna (konum, boyut, stiller, büyütülmüş) geri getirir.
    pub fn release(target: i64) -> Result<(), String> {
        on_host(move || {
            let entry = {
                let mut reg = registry();
                let pos = reg.iter().position(|e| e.hwnd == target as isize).ok_or("Pencere gömülü değil")?;
                reg.remove(pos)
            };
            restore(&entry);
            unsafe {
                let _ = SetForegroundWindow(hwnd(entry.hwnd));
            }
            Ok(())
        })?
    }

    fn take(filter: impl Fn(&Embedded) -> bool) -> Vec<Embedded> {
        let mut reg = registry();
        let (gone, keep): (Vec<_>, Vec<_>) = reg.drain(..).partition(|e| filter(e));
        *reg = keep;
        gone
    }

    /// Bir Alpicim penceresi kapanmadan önce ona bağlı tüm dış pencereleri serbest bırakır.
    pub fn release_host(host: isize) {
        let entries = take(|e| e.host == host);
        if entries.is_empty() {
            return;
        }
        if on_host(move || entries.iter().for_each(restore)).is_err() {
            eprintln!("[embed] serbest bırakma zaman aşımına uğradı");
        }
    }

    /// Çıkışta tümünü serbest bırakır. Kapsayıcı iş parçacığı yanıt vermezse doğrudan bu iş parçacığında dener.
    pub fn release_all() {
        let entries = take(|_| true);
        if entries.is_empty() {
            return;
        }
        let ids: Vec<isize> = entries.iter().map(|e| e.hwnd).collect();
        let fallback: Vec<(isize, Saved, isize)> = entries.iter().map(|e| (e.hwnd, e.saved.clone(), e.container)).collect();
        if on_host(move || entries.iter().for_each(restore)).is_err() {
            for (h, saved, container) in fallback {
                restore(&Embedded { hwnd: h, host: 0, container, pid: 0, saved, rel: Bounds::default(), wanted: false });
            }
        }
        eprintln!("[embed] {} pencere serbest bırakıldı", ids.len());
    }

    /// Panik kancası için: başka iş parçacığına iş göndermeden, doğrudan geri al.
    pub fn release_all_direct() {
        for e in take(|_| true) {
            restore(&e);
        }
    }

    /// Gömülü pencerelerden hâlâ var olanlar; kapananların kapsayıcıları temizlenir.
    pub fn alive() -> Vec<i64> {
        let dead = take(|e| unsafe { !IsWindow(Some(hwnd(e.hwnd))).as_bool() });
        if !dead.is_empty() {
            let _ = on_host(move || {
                for e in dead {
                    unsafe {
                        let _ = DestroyWindow(hwnd(e.container));
                    }
                }
            });
        }
        registry().iter().map(|e| e.hwnd as i64).collect()
    }

    /// Testler için: dış pencerenin bağlı olduğu kapsayıcı.
    #[cfg(test)]
    pub fn container_of(target: i64) -> Option<isize> {
        registry().iter().find(|e| e.hwnd == target as isize).map(|e| e.container)
    }

    /// Listede görünen türden (üst düzey, başka sürece ait) bir pencereyi öne getirir. Gömülmeyen
    /// uygulamalar için alternatif: "pencereye odaklan".
    pub fn activate(target: i64) -> Result<(), String> {
        let h = hwnd(target as isize);
        describe(h).ok_or("Pencere bulunamadı")?;
        unsafe {
            if IsIconic(h).as_bool() {
                let _ = ShowWindow(h, SW_RESTORE);
            }
            if SetForegroundWindow(h).as_bool() {
                Ok(())
            } else {
                Err("Windows pencereyi öne getirmeye izin vermedi".into())
            }
        }
    }

    /// Verilen exe'nin açık bir penceresi varsa öne getirir (akıllı kısayollar).
    pub fn focus_exe(exe: &str) -> bool {
        let wanted = exe.to_ascii_lowercase();
        let Some(found) = list().into_iter().find(|w| w.exe_path.to_ascii_lowercase() == wanted) else {
            return false;
        };
        let h = hwnd(found.hwnd as isize);
        unsafe {
            if IsIconic(h).as_bool() {
                let _ = ShowWindow(h, SW_RESTORE);
            }
            SetForegroundWindow(h).as_bool()
        }
    }

    /// Gerçek bir dış uygulamayla uçtan uca deneme. Ekranda pencere açtığı için varsayılan olarak çalışmaz:
    /// `cargo test --manifest-path src-tauri/Cargo.toml -- --ignored --nocapture embed_roundtrip`
    #[cfg(test)]
    mod live_tests {
        use std::time::{Duration, Instant};

        use windows::core::w;

        use super::*;

        fn pump(ms: u64) {
            let end = Instant::now() + Duration::from_millis(ms);
            while Instant::now() < end {
                unsafe {
                    let mut msg = MSG::default();
                    while PeekMessageW(&mut msg, None, 0, 0, PM_REMOVE).as_bool() {
                        let _ = TranslateMessage(&msg);
                        DispatchMessageW(&msg);
                    }
                }
                std::thread::sleep(Duration::from_millis(20));
            }
        }

        fn rect_of(h: HWND) -> RECT {
            let mut r = RECT::default();
            unsafe {
                let _ = GetWindowRect(h, &mut r);
            }
            r
        }

        use windows::Win32::Foundation::RECT;

        fn size(r: RECT) -> (i32, i32) {
            (r.right - r.left, r.bottom - r.top)
        }

        fn create_host() -> HWND {
            unsafe {
                CreateWindowExW(
                    WINDOW_EX_STYLE(0),
                    w!("STATIC"),
                    w!("Alpicim gomme testi"),
                    WS_OVERLAPPEDWINDOW | WS_VISIBLE,
                    100,
                    100,
                    900,
                    700,
                    None,
                    None,
                    None,
                    None,
                )
                .expect("test ebeveyn penceresi")
            }
        }

        /// Programı başlatır ve süreç adı eşleşen YENİ bir üst düzey pencere bekler.
        fn launch_and_find(mut cmd: std::process::Command, process: &str) -> WindowInfo {
            let before: Vec<i64> = list().iter().map(|w| w.hwnd).collect();
            let _child = cmd.spawn().expect("program başlatılamadı");
            let deadline = Instant::now() + Duration::from_secs(20);
            loop {
                pump(250);
                if let Some(w) = list()
                    .into_iter()
                    .find(|w| w.process_name.eq_ignore_ascii_case(process) && !before.contains(&w.hwnd))
                {
                    // Pencerenin oluşumunu tamamlaması için kısa süre tanı.
                    pump(800);
                    return info(w.hwnd).unwrap_or(w);
                }
                assert!(Instant::now() < deadline, "{process} penceresi bulunamadı");
            }
        }

        /// Uçtan uca: yerleştir → boyutlandır → gizle/göster → odak → ayır → eski hâline dön.
        /// Herhangi bir adım başarısız olursa önce pencere serbest bırakılır, sonra hata döner.
        fn roundtrip(host: HWND, target: &WindowInfo) -> Result<(), String> {
            let h = hwnd(target.hwnd as isize);
            let host_id = host.0 as isize;
            let check = |ok: bool, what: &str| -> Result<(), String> {
                if ok {
                    Ok(())
                } else {
                    release_all();
                    Err(format!("{what} (IsWindow={})", unsafe { IsWindow(Some(h)).as_bool() }))
                }
            };
            unsafe {
                let style_before = GetWindowLongPtrW(h, GWL_STYLE);
                let ex_before = GetWindowLongPtrW(h, GWL_EXSTYLE);
                let rect_before = rect_of(h);

                let b = Bounds { x: 20, y: 20, width: 600, height: 400 };
                embed(target.hwnd, host_id, b)?;
                pump(600);
                let container = container_of(target.hwnd).map(|c| hwnd(c));
                check(container.is_some_and(|c| GetAncestor(h, GA_PARENT) == c), "kapsayıcıya alınmadı")?;
                check(container.is_some_and(|c| IsWindowVisible(c).as_bool()), "kapsayıcı görünmüyor")?;
                let style = GetWindowLongPtrW(h, GWL_STYLE) as u32;
                check(style & WS_CHILD.0 != 0 && style & WS_CAPTION.0 != WS_CAPTION.0, "stiller uygulanmadı")?;
                println!("  yerleşti: {:?}", size(rect_of(h)));

                set_bounds(target.hwnd, Bounds { x: 10, y: 10, width: 500, height: 300 }, true)?;
                pump(600);
                println!("  boyutlandı: {:?}", size(rect_of(h)));
                check(size(rect_of(h)) == (500, 300), "boyut uygulanmadı")?;

                set_bounds(target.hwnd, b, false)?;
                pump(300);
                check(!IsWindowVisible(h).as_bool(), "gizlenmedi")?;
                set_bounds(target.hwnd, b, true)?;
                pump(300);
                check(IsWindowVisible(h).as_bool(), "tekrar gösterilmedi")?;

                focus(target.hwnd, host_id)?;
                pump(300);
                check(IsWindow(Some(h)).as_bool(), "odak sonrası pencere kapandı")?;

                release(target.hwnd)?;
                pump(600);
                check(GetAncestor(h, GA_PARENT) == GetDesktopWindow(), "masaüstüne dönmedi")?;
                check(GetWindowLongPtrW(h, GWL_STYLE) == style_before, "stil geri yüklenmedi")?;
                check(GetWindowLongPtrW(h, GWL_EXSTYLE) == ex_before, "genişletilmiş stil geri yüklenmedi")?;
                println!("  ayrıldı: önce {:?} sonra {:?}", size(rect_before), size(rect_of(h)));
                check(size(rect_of(h)) == size(rect_before), "eski boyut geri gelmedi")?;
                check(IsWindowVisible(h).as_bool(), "ayrıldıktan sonra görünmüyor")?;
                check(!alive().contains(&target.hwnd), "kayıtta kaldı")?;
            }
            Ok(())
        }

        fn close(target: &WindowInfo) {
            unsafe {
                let _ = PostMessageW(Some(hwnd(target.hwnd as isize)), WM_CLOSE, windows::Win32::Foundation::WPARAM(0), LPARAM(0));
            }
            pump(500);
        }

        #[test]
        #[ignore = "Karakter Eşlem açar; elle çalıştırın"]
        fn embed_roundtrip_charmap() {
            let host = create_host();
            pump(200);
            let target = launch_and_find(std::process::Command::new("charmap.exe"), "charmap.exe");
            println!("Hedef: {:?} sınıf={} gömülebilir={}", target.title, target.class_name, target.embeddable);
            let result = roundtrip(host, &target);
            close(&target);
            unsafe {
                let _ = DestroyWindow(host);
            }
            result.expect("Karakter Eşlem uçtan uca");
        }

        #[test]
        #[ignore = "Geçici profille ayrı bir Microsoft Edge (Chromium) açar; elle çalıştırın"]
        fn embed_roundtrip_edge_chromium() {
            let exe = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
            let profile = std::env::temp_dir().join(format!("alpicim-embed-edge-{}", std::process::id()));
            let mut cmd = std::process::Command::new(exe);
            cmd.arg(format!("--user-data-dir={}", profile.display()))
                .args(["--no-first-run", "--no-default-browser-check", "--new-window", "about:blank"]);
            let host = create_host();
            pump(200);
            let target = launch_and_find(cmd, "msedge.exe");
            println!("Hedef: {:?} sınıf={} gömülebilir={}", target.title, target.class_name, target.embeddable);
            let result = roundtrip(host, &target);
            close(&target);
            unsafe {
                let _ = DestroyWindow(host);
            }
            pump(1500);
            let _ = std::fs::remove_dir_all(&profile);
            result.expect("Edge (Chromium) uçtan uca");
        }

        /// Win11 Not Defteri (Store/WinUI) gömülünce penceresini kapattığı için engellenmeli ve dokunulmamalı.
        #[test]
        #[ignore = "Not Defteri açar; elle çalıştırın"]
        fn store_notepad_is_refused_without_side_effects() {
            let host = create_host();
            pump(200);
            let target = launch_and_find(std::process::Command::new("notepad.exe"), "notepad.exe");
            println!("Hedef: {:?} yol={} neden={:?}", target.title, target.exe_path, target.reason);
            let h = hwnd(target.hwnd as isize);
            let style_before = unsafe { GetWindowLongPtrW(h, GWL_STYLE) };
            let result = embed(target.hwnd, host.0 as isize, Bounds { x: 0, y: 0, width: 400, height: 300 });
            pump(300);
            let untouched = unsafe {
                GetAncestor(h, GA_PARENT) == GetDesktopWindow() && GetWindowLongPtrW(h, GWL_STYLE) == style_before
            };
            close(&target);
            unsafe {
                let _ = DestroyWindow(host);
            }
            assert!(result.is_err(), "Store Not Defteri reddedilmeliydi");
            assert!(untouched, "Reddedilen pencere değiştirilmiş");
        }

        #[test]
        #[ignore = "Görev çubuğuna dokunmadığını doğrular; elle çalıştırın"]
        fn system_windows_are_refused() {
            let host = create_host();
            unsafe {
                let tray = FindWindowW(w!("Shell_TrayWnd"), None).expect("görev çubuğu");
                let style = GetWindowLongPtrW(tray, GWL_STYLE);
                assert!(embed(tray.0 as isize as i64, host.0 as isize, Bounds { x: 0, y: 0, width: 10, height: 10 }).is_err());
                assert_eq!(GetAncestor(tray, GA_PARENT), GetDesktopWindow());
                assert_eq!(GetWindowLongPtrW(tray, GWL_STYLE), style);
                let _ = DestroyWindow(host);
            }
        }
    }
}

#[cfg(windows)]
pub use imp::{
    activate, alive, embed, focus, focus_exe, foreground_foreign, hide_host, info, known_in_session, list, release,
    release_all, release_all_direct, release_host, set_bounds, sync_host, Bounds,
};

#[cfg(not(windows))]
pub fn release_all_direct() {}

/// Alpicim penceresi taşındı/boyutlandı/odaklandı/gösterildi: gömülü pencerelerin kapsayıcılarını hizala.
pub fn sync_window<R: tauri::Runtime>(window: &tauri::Window<R>) {
    #[cfg(windows)]
    if let Ok(h) = window.hwnd() {
        sync_host(h.0 as isize);
    }
    #[cfg(not(windows))]
    let _ = window;
}

/// Alpicim penceresi gizlenirken kapsayıcıları da gizle (sahipli pencere olmadıkları için otomatik gizlenmezler).
pub fn hide_window<R: tauri::Runtime>(window: &tauri::Window<R>) {
    #[cfg(windows)]
    if let Ok(h) = window.hwnd() {
        hide_host(h.0 as isize);
    }
    #[cfg(not(windows))]
    let _ = window;
}

#[cfg(not(windows))]
pub fn release_all() {}

// ---------------------------------------------------------------------------
// Komutlar (hepsi async: hedef uygulama yanıt vermezse ana iş parçacığı kilitlenmesin)
// ---------------------------------------------------------------------------

#[cfg(windows)]
mod commands {
    use std::time::{Duration, Instant};

    use tauri::{Runtime, Window};

    use super::*;

    fn host_of<R: Runtime>(window: &Window<R>) -> Result<isize, String> {
        window.hwnd().map(|h| h.0 as isize).map_err(|e| e.to_string())
    }

    fn to_physical<R: Runtime>(window: &Window<R>, x: f64, y: f64, w: f64, h: f64) -> Bounds {
        let s = window.scale_factor().unwrap_or(1.0);
        Bounds {
            x: (x * s).round() as i32,
            y: (y * s).round() as i32,
            width: (w * s).round() as i32,
            height: (h * s).round() as i32,
        }
    }

    #[tauri::command]
    pub async fn embed_list() -> Vec<WindowInfo> {
        list()
    }

    /// Seçim modu: kullanıcı `timeout_ms` içinde başka bir pencereye tıklarsa o pencereyi döndürür.
    #[tauri::command]
    pub async fn embed_pick(timeout_ms: Option<u64>) -> Option<WindowInfo> {
        let deadline = Instant::now() + Duration::from_millis(timeout_ms.unwrap_or(15_000).min(60_000));
        tauri::async_runtime::spawn_blocking(move || {
            while Instant::now() < deadline {
                if let Some(w) = foreground_foreign() {
                    return Some(w);
                }
                std::thread::sleep(Duration::from_millis(120));
            }
            None
        })
        .await
        .ok()
        .flatten()
    }

    #[tauri::command]
    pub async fn embed_attach<R: Runtime>(
        window: Window<R>,
        hwnd: i64,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    ) -> Result<WindowInfo, String> {
        let host = host_of(&window)?;
        let b = to_physical(&window, x, y, width, height);
        embed(hwnd, host, b)
    }

    #[tauri::command]
    pub async fn embed_set_bounds<R: Runtime>(
        window: Window<R>,
        hwnd: i64,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        visible: bool,
    ) -> Result<(), String> {
        let b = to_physical(&window, x, y, width, height);
        set_bounds(hwnd, b, visible && width >= 2.0 && height >= 2.0)
    }

    #[tauri::command]
    pub async fn embed_focus<R: Runtime>(window: Window<R>, hwnd: i64) -> Result<(), String> {
        focus(hwnd, host_of(&window)?)
    }

    #[tauri::command]
    pub async fn embed_release(hwnd: i64) -> Result<(), String> {
        release(hwnd)
    }

    #[tauri::command]
    pub async fn embed_alive() -> Vec<i64> {
        alive()
    }

    #[tauri::command]
    pub async fn embed_info(hwnd: i64) -> Option<WindowInfo> {
        info(hwnd)
    }

    /// Pencere bu süreçte daha önce gömüldü mü? (Yeni açılışta otomatik yeniden gömme yapılmaz.)
    #[tauri::command]
    pub async fn embed_known(hwnd: i64) -> bool {
        known_in_session(hwnd)
    }

    #[tauri::command]
    pub async fn embed_activate(hwnd: i64) -> Result<(), String> {
        activate(hwnd)
    }

    #[tauri::command]
    pub async fn embed_find_exe(exe: String) -> Option<WindowInfo> {
        let wanted = exe.to_ascii_lowercase();
        list().into_iter().find(|w| w.embeddable && w.exe_path.to_ascii_lowercase() == wanted)
    }
}

#[cfg(windows)]
pub use commands::*;

/// Pencere kapanmadan önce (panel penceresi) içindeki gömülü pencereleri bırakır.
pub fn release_for_window<R: tauri::Runtime>(window: &tauri::Window<R>) {
    #[cfg(windows)]
    if let Ok(h) = window.hwnd() {
        release_host(h.0 as isize);
    }
    #[cfg(not(windows))]
    let _ = window;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_system_and_elevated_windows() {
        let discord = r"C:\Users\x\AppData\Local\Discord\app-1.0\Discord.exe";
        assert!(classify("Notepad", "notepad.exe", r"C:\Windows\notepad.exe", true).is_none());
        assert!(classify("Chrome_WidgetWin_1", "Discord.exe", discord, true).is_none());
        assert!(classify("CabinetWClass", "explorer.exe", r"C:\Windows\explorer.exe", true).is_none());
        assert!(classify("Shell_TrayWnd", "explorer.exe", r"C:\Windows\explorer.exe", true).is_some());
        assert!(classify("Progman", "explorer.exe", r"C:\Windows\explorer.exe", true).is_some());
        assert!(classify("ApplicationFrameWindow", "ApplicationFrameHost.exe", "", true).is_some());
        assert!(classify("Notepad", "notepad.exe", r"C:\Windows\notepad.exe", false).is_some());
        assert!(classify("Anything", "Taskmgr.exe", "", true).is_some());
        let store = r"C:\Program Files\WindowsApps\Microsoft.WindowsNotepad_11_x64__8wekyb3d8bbwe\Notepad\Notepad.exe";
        assert!(classify("Notepad", "Notepad.exe", store, true).is_some());
    }
}
