#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use std::sync::Mutex;

use tauri::{
    menu::{Menu, MenuBuilder, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, Runtime,
};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

mod db;
mod error_handler;
mod eyecare;
mod floating;
mod reminder;
mod system;

/// 打开主窗口 DevTools（调试构建可用）
#[tauri::command]
fn open_devtools(app: AppHandle) {
    #[cfg(debug_assertions)]
    if let Some(w) = app.get_webview_window("main") {
        w.open_devtools();
    }
}

fn main() {
    error_handler::install_panic_handler();
    
    let reminder_paused = Arc::new(Mutex::new(false));

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            db::db_execute,
            db::db_query,
            open_devtools,
            floating::create_floating_card,
            floating::hide_floating_card,
            floating::close_floating_card,
            floating::set_floating_position,
            floating::set_click_through,
            floating::set_all_floating_click_through,
            floating::restore_floating_click_through,
            floating::set_floating_always_on_top,
            floating::get_floating_card_count,
            floating::get_floating_card_labels,
            reminder::create_drinking_popup,
            reminder::create_standing_popup,
            eyecare::trigger_eyecare,
            system::set_auto_start,
            system::get_auto_start,
        ])
        .setup(move |app| {
            let app_handle = app.handle();
            let rp_clone1 = Arc::clone(&reminder_paused);
            let rp_clone2 = Arc::clone(&reminder_paused);

            let _ = db::init_db();
            // Quick DB test on startup
            match db::quick_test() {
                Ok(()) => println!("[STARTUP] DB quick test PASSED"),
                Err(e) => println!("[STARTUP] DB quick test FAILED: {}", e),
            }

            let icon = app.default_window_icon().unwrap().clone();

            let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>).unwrap();
            let add_item = MenuItem::with_id(app, "add", "快速添加任务", true, None::<&str>).unwrap();
            let pause_item = MenuItem::with_id(app, "pause", "暂停所有提醒", true, None::<&str>).unwrap();
            let settings_item = MenuItem::with_id(app, "settings", "设置", true, None::<&str>).unwrap();
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>).unwrap();

            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&add_item)
                .separator()
                .item(&pause_item)
                .item(&settings_item)
                .separator()
                .item(&quit_item)
                .build()
                .unwrap();

            let ah1 = app_handle.clone();
            let ah2 = app_handle.clone();
            let ah3 = app_handle.clone();
            let rp1 = rp_clone1;
            let rp2 = rp_clone2;
            let _rp3 = Arc::clone(&rp1);
            let rp4 = Arc::clone(&rp2);

            let main_window = app.get_webview_window("main").unwrap();
            let _ = main_window.show();
            let _ = main_window.set_focus();

            TrayIconBuilder::with_id("main")
                .icon(icon)
                .menu(&menu)
                .on_tray_icon_event(move |_, event| {
                    use tauri::tray::TrayIconEvent;
                    if let TrayIconEvent::DoubleClick { .. } = event {
                        let w = ah1.get_webview_window("main").unwrap();
                        if w.is_visible().unwrap() { w.hide().unwrap(); }
                        else { w.show().unwrap(); w.set_focus().unwrap(); }
                    }
                })
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            let w = app.get_webview_window("main").unwrap();
                            w.show().unwrap(); w.set_focus().unwrap();
                        }
                        "add" => {
                            let w = app.get_webview_window("main").unwrap();
                            w.show().unwrap(); w.set_focus().unwrap();
                            let _ = w.emit("show-add-modal", ());
                        }
                        "pause" => {
                            let mut p = rp1.lock().unwrap();
                            *p = !*p;
                            let t = app.tray_by_id("main").unwrap();
                            let new_menu = build_menu(app, &rp1);
                            t.set_menu(Some(new_menu)).unwrap();
                        }
                        "settings" => {
                            let w = app.get_webview_window("main").unwrap();
                            w.show().unwrap(); w.set_focus().unwrap();
                        }
                        "quit" => std::process::exit(0),
                        _ => {}
                    }
                })
                .build(app)
                .unwrap();

            let sm = ah2.global_shortcut();
            let _ = sm.on_shortcut("Ctrl+Shift+A", move |app, _, _| {
                let w = app.get_webview_window("main").unwrap();
                w.show().unwrap(); w.set_focus().unwrap();
                let _ = w.emit("show-add-modal", ());
            });
            // F12 DevTools 由前端监听并通过 open_devtools 命令触发
            let _ = sm.on_shortcut("Ctrl+Shift+M", move |app, _, _| {
                let w = app.get_webview_window("main").unwrap();
                if w.is_visible().unwrap() { w.hide().unwrap(); }
                else { w.show().unwrap(); w.set_focus().unwrap(); }
            });
            let _ = sm.on_shortcut("Ctrl+Shift+P", move |app, _, _| {
                let mut p = rp4.lock().unwrap();
                *p = !*p;
                let t = app.tray_by_id("main").unwrap();
                let new_menu = build_menu(app, &rp4);
                t.set_menu(Some(new_menu)).unwrap();
            });

            Ok(())
        })
        .on_window_event(|app, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                let label = app.label().to_string();
                // 悬浮卡片、健康提醒弹窗（喝水/久坐）、护眼黑屏：正常关闭（销毁窗口）
                if label.starts_with("floating-")
                    || label == "drinking-popup"
                    || label == "standing-popup"
                    || label == "eyecare-blackscreen"
                {
                    return;
                }
                // Main window: hide instead of close；隐藏后恢复锁定卡片的点击穿透
                let w = app.get_webview_window("main").unwrap();
                if w.is_visible().unwrap_or(false) {
                    w.hide().unwrap();
                    api.prevent_close();
                    let _ = floating::restore_floating_click_through(app.app_handle().clone());
                }
            }
            // 主窗口聚焦时：所有悬浮卡片临时可交互（方便调整锁定中的卡片）；
            // 主窗口失焦时：按锁定状态恢复（锁定卡片恢复点击穿透）
            tauri::WindowEvent::Focused(focused) => {
                if app.label() == "main" {
                    let handle = app.app_handle();
                    if *focused {
                        let _ = floating::set_all_floating_click_through(handle.clone(), false);
                    } else {
                        let _ = floating::restore_floating_click_through(handle.clone());
                    }
                }
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error");
}

fn build_menu<R: Runtime>(app: &impl Manager<R>, rp: &Arc<Mutex<bool>>) -> Menu<R> {
    let paused = *rp.lock().unwrap();
    let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>).unwrap();
    let add = MenuItem::with_id(app, "add", "快速添加任务", true, None::<&str>).unwrap();
    let pause_text = if paused { "暂停所有提醒 ✓" } else { "暂停所有提醒" };
    let pause = MenuItem::with_id(app, "pause", pause_text, true, None::<&str>).unwrap();
    let set = MenuItem::with_id(app, "settings", "设置", true, None::<&str>).unwrap();
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>).unwrap();
    MenuBuilder::new(app)
        .item(&show).item(&add).separator()
        .item(&pause).item(&set).separator()
        .item(&quit).build().unwrap()
}
