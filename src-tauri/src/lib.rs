//! Alpicim — Tauri giriş noktası.

mod adblock;
mod browser;
mod clipboard;
mod display;
mod embed;
mod geometry;
mod hotkeys;
mod launcher;
mod music;
mod net;
mod providers;
mod scanner;
mod secrets;
mod system;
mod tray;
mod windows;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Panik olursa bile gömülü dış pencereler bağımsız hâle getirilsin (aksi hâlde ebeveynle birlikte kapanabilirler).
    let previous_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        embed::release_all_direct();
        previous_hook(info);
    }));

    tauri::Builder::default()
        // İkinci kez açılırsa yeni örnek yerine mevcut pencereyi öne getir (ilk kayıtlı eklenti olmalı).
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            windows::show_main(app);
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let config_dir = app.path().app_config_dir()?;
            std::fs::create_dir_all(&config_dir)?;

            app.manage(windows::LayoutState::load(config_dir.clone()));
            app.manage(clipboard::ClipboardState::load(config_dir.clone()));
            app.manage(launcher::LauncherState::load(config_dir));
            app.manage(net::NetState::new().map_err(std::io::Error::other)?);
            app.manage(display::DisplayState::default());
            app.manage(hotkeys::HotkeyState::default());

            let handle = app.handle().clone();
            tray::create(&handle)?;
            windows::spawn_autosave(handle.clone());
            hotkeys::spawn(handle.clone());
            clipboard::spawn(handle.clone());
            // Reklam engelleyici: ayarlar + önbellekten motor + liste yenileme arka planda (kurulumu bekletmez).
            if let Err(err) = adblock::init(&handle) {
                eprintln!("Reklam engelleyici başlatılamadı: {err}");
            }

            // Ana pencere görünmez başlar; kayıtlı konumu doğrulanıp uygulanınca gösterilir.
            if let Some(main) = app.get_webview_window(windows::MAIN_LABEL) {
                let state = app.state::<windows::LayoutState>();
                windows::restore_and_show(&main, &state);
            }

            // Önceki oturumda ayrı pencerede açık olan panelleri geri getir.
            let detached = app.state::<windows::LayoutState>().snapshot().detached;
            for panel in detached {
                if let Err(err) = windows::open_panel_window(&handle, &panel) {
                    eprintln!("Panel geri yüklenemedi ({panel}): {err}");
                }
            }
            Ok(())
        })
        .on_window_event(windows::handle_window_event)
        .invoke_handler(tauri::generate_handler![
            windows::layout_get,
            windows::panel_open_window,
            windows::panel_close_window,
            windows::window_set_always_on_top,
            windows::layout_set_close_to_tray,
            windows::layout_set_start_hidden,
            windows::app_quit,
            windows::app_hide_main,
            display::display_get,
            display::display_set,
            display::display_move_to_target,
            display::display_toggle_fullscreen,
            hotkeys::shortcuts_get,
            hotkeys::shortcuts_set,
            clipboard::clipboard_list,
            clipboard::clipboard_copy,
            clipboard::clipboard_delete,
            clipboard::clipboard_clear,
            clipboard::clipboard_set_paused,
            clipboard::clipboard_pin,
            net::net_get,
            secrets::secret_set,
            secrets::secret_clear,
            secrets::secret_status,
            launcher::launcher_list,
            launcher::launcher_add,
            launcher::launcher_update,
            launcher::launcher_remove,
            launcher::launcher_reorder,
            launcher::launcher_launch,
            launcher::launcher_add_many,
            launcher::launcher_scan,
            launcher::launcher_icon,
            browser::browser_open,
            browser::browser_set_bounds,
            browser::browser_navigate,
            browser::browser_action,
            browser::browser_close,
            browser::browser_close_all,
            adblock::adblock_status,
            adblock::adblock_set_enabled,
            adblock::adblock_update,
            adblock::adblock_site_allow,
            music::music_open,
            music::music_set_bounds,
            music::music_release,
            music::music_close,
            music::music_is_open,
            music::music_action,
            music::music_set_muted,
            music::music_search,
            system::system_stats,
            system::autostart_get,
            system::autostart_set,
            system::media_sessions,
            system::media_command,
            embed::embed_list,
            embed::embed_pick,
            embed::embed_attach,
            embed::embed_set_bounds,
            embed::embed_focus,
            embed::embed_release,
            embed::embed_alive,
            embed::embed_info,
            embed::embed_find_exe,
            embed::embed_activate,
            embed::embed_known,
        ])
        .build(tauri::generate_context!())
        .expect("Alpicim başlatılamadı")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                embed::release_all();
                if let Some(state) = app.try_state::<windows::LayoutState>() {
                    state.exiting.store(true, std::sync::atomic::Ordering::SeqCst);
                    state.save_if_dirty();
                }
            }
        });
}
