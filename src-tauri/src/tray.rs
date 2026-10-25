//! Sistem tepsisi simgesi ve menüsü.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Runtime,
};

use crate::windows::{open_panel_window, quit, show_main, toggle_main};

pub fn create<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Alpicim'i göster / gizle", true, None::<&str>)?;
    let fullscreen = MenuItem::with_id(app, "fullscreen", "Tam ekran aç / kapat", true, None::<&str>)?;
    let news = MenuItem::with_id(app, "panel:news", "Haberler penceresi", true, None::<&str>)?;
    let markets = MenuItem::with_id(app, "panel:markets", "Piyasalar penceresi", true, None::<&str>)?;
    let launcher =
        MenuItem::with_id(app, "panel:launcher", "Uygulamalar penceresi", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Tamamen çık", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(
        app,
        &[&show, &fullscreen, &sep1, &news, &markets, &launcher, &sep2, &quit_item],
    )?;

    let mut builder = TrayIconBuilder::with_id("alpicim-tray")
        .tooltip("Alpicim")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let id = event.id.as_ref();
            match id {
                "show" => toggle_main(app),
                "fullscreen" => {
                    let _ = crate::display::toggle_fullscreen(app);
                }
                "quit" => quit(app),
                _ => {
                    if let Some(panel) = id.strip_prefix("panel:") {
                        let _ = open_panel_window(app, panel);
                    }
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}
