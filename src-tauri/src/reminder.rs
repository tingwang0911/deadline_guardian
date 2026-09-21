//! 健康提醒弹窗（喝水提醒、久坐/站立提醒）。
//!
//! 与悬浮卡片同样的防死锁原则：窗口构建派发到主事件循环执行，
//! 命令本身立即返回，绝不在 IPC 调用栈内同步 build WebView2 窗口。

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

/// 在主事件循环上构建（或前置）一个右下角置顶弹窗。
fn show_popup(app: &AppHandle, label: &str, url_path: &str, win_w: f64, win_h: f64, log_tag: &str) {
    // 已存在：直接前置
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        return;
    }

    // 右下角定位（主显示器工作区，留任务栏边距）
    let (x, y) = if let Ok(Some(mon)) = app.primary_monitor() {
        let scale = mon.scale_factor();
        let mx = mon.position().x as f64 / scale;
        let my = mon.position().y as f64 / scale;
        let sw = mon.size().width as f64 / scale;
        let sh = mon.size().height as f64 / scale;
        (mx + sw - win_w - 24.0, my + sh - win_h - 48.0)
    } else {
        (20.0, 20.0)
    };

    let url = format!("index.html?window={}", url_path);
    match WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()))
        .title("")
        .inner_size(win_w, win_h)
        .position(x, y)
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(true)
        .build()
    {
        Ok(_) => println!("[REMINDER] {} popup created", log_tag),
        Err(e) => {
            println!("[REMINDER] {} popup build failed: {}", log_tag, e);
            let _ = app.emit(
                "reminder-popup-failed",
                format!("提醒弹窗创建失败：{}", e),
            );
        }
    }
}

/// 弹出"该喝水啦"提醒窗口（右下角、置顶、无标题栏）。
#[tauri::command]
pub async fn create_drinking_popup(app: AppHandle) -> Result<(), String> {
    let app_clone = app.clone();
    app.run_on_main_thread(move || {
        show_popup(&app_clone, "drinking-popup", "drinking-popup", 340.0, 400.0, "drinking");
    })
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 弹出"久坐/站立"提醒窗口（右下角、置顶、无标题栏）。
#[tauri::command]
pub async fn create_standing_popup(app: AppHandle) -> Result<(), String> {
    let app_clone = app.clone();
    app.run_on_main_thread(move || {
        show_popup(&app_clone, "standing-popup", "standing-popup", 340.0, 400.0, "standing");
    })
    .map_err(|e| e.to_string())?;
    Ok(())
}
