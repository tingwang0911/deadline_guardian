use tauri::{AppHandle, Emitter, LogicalPosition, Manager, WebviewUrl, WebviewWindowBuilder};

/// 悬浮卡片数量上限
const MAX_FLOATING_CARDS: usize = 10;

/// Create or show a floating card window for a task.
///
/// 注意：此命令为 async（在线程池执行），窗口构建通过 `run_on_main_thread`
/// 派发到主事件循环空闲时执行。**不要在 Tauri 命令调用栈里同步 build WebView2
/// 窗口**——wry 构建时会在主线程嵌套消息循环等待 webview 就绪，与命令分发
/// 重入会导致主线程永久卡死（所有后续 invoke 无响应，前端 15s 超时）。
#[tauri::command]
pub async fn create_floating_card(
    app: AppHandle,
    task_id: String,
    pos_x: Option<f64>,
    pos_y: Option<f64>,
    card_width: Option<f64>,
) -> Result<(), String> {
    let label = format!("floating-{}", task_id);

    // 窗口已存在：显示即可（窗口操作内部自动 marshal 到主线程）
    if let Some(win) = app.get_webview_window(&label) {
        if !win.is_visible().unwrap_or(false) {
            win.show().map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    // 上限检查与窗口构建都派发到主线程，在同一回调内串行完成：
    // 1) 检查与构建原子化，消除并发请求（如启动时批量恢复）同时读到旧计数、
    //    把 10 张上限击穿的竞态；
    // 2) build 不在 IPC 命令调用栈内执行，避免 wry 嵌套消息循环与命令分发重入死锁。
    let app_clone = app.clone();
    app.run_on_main_thread(move || {
        // 防御：派发期间窗口可能已被其他路径创建
        if app_clone.get_webview_window(&label).is_some() {
            return;
        }
        let count = app_clone
            .webview_windows()
            .keys()
            .filter(|k| k.starts_with("floating-"))
            .count();
        if count >= MAX_FLOATING_CARDS {
            let msg = format!("悬浮卡片数量已达上限（{} 张），请先完成或隐藏部分卡片", MAX_FLOATING_CARDS);
            println!("[FLOATING] create rejected (limit {}): {}", MAX_FLOATING_CARDS, task_id);
            // 通知前端给出可见提示（命令本身仍返回 Ok，构建是异步派发的）
            let _ = app_clone.emit("floating-card-create-failed", &msg);
            return;
        }
        if let Err(e) = build_floating_window(&app_clone, &task_id, pos_x, pos_y, card_width) {
            println!("[FLOATING] create card failed for task {}: {}", task_id, e);
            let _ = app_clone
                .emit("floating-card-create-failed", format!("悬浮卡片创建失败：{}", e));
        }
    })
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// 在主线程上实际构建悬浮卡片窗口（仅由 run_on_main_thread 回调调用）
fn build_floating_window(
    app: &AppHandle,
    task_id: &str,
    pos_x: Option<f64>,
    pos_y: Option<f64>,
    card_width: Option<f64>,
) -> tauri::Result<()> {
    let label = format!("floating-{}", task_id);

    // 防御：派发期间窗口可能已被其他路径创建
    if app.get_webview_window(&label).is_some() {
        return Ok(());
    }

    let x = pos_x.unwrap_or(20.0);
    let y = pos_y.unwrap_or(20.0);
    let w = card_width.unwrap_or(220.0);

    let url = format!("index.html?window=floating&task={}", task_id);

    WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.into()))
        .title("")
        .inner_size(w, 96.0)
        .position(x, y)
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .build()?;

    println!("[FLOATING] card created for task: {}", task_id);
    Ok(())
}

/// Hide a floating card window (not destroy)
#[tauri::command]
pub fn hide_floating_card(app: AppHandle, task_id: String) -> Result<(), String> {
    let label = format!("floating-{}", task_id);
    if let Some(win) = app.get_webview_window(&label) {
        win.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Close/destroy a floating card window
#[tauri::command]
pub fn close_floating_card(app: AppHandle, task_id: String) -> Result<(), String> {
    let label = format!("floating-{}", task_id);
    if let Some(win) = app.get_webview_window(&label) {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Update floating card window position (for drag)
#[tauri::command]
pub fn set_floating_position(
    app: AppHandle,
    task_id: String,
    x: f64,
    y: f64,
) -> Result<(), String> {
    let label = format!("floating-{}", task_id);
    if let Some(win) = app.get_webview_window(&label) {
        win.set_position(tauri::Position::Logical(LogicalPosition::new(x, y)))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Toggle click-through (mouse events pass through window)
#[tauri::command]
pub fn set_click_through(
    app: AppHandle,
    task_id: String,
    enabled: bool,
) -> Result<(), String> {
    let label = format!("floating-{}", task_id);
    if let Some(win) = app.get_webview_window(&label) {
        win.set_ignore_cursor_events(enabled)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Toggle always-on-top
#[tauri::command]
pub fn set_floating_always_on_top(
    app: AppHandle,
    task_id: String,
    enabled: bool,
) -> Result<(), String> {
    let label = format!("floating-{}", task_id);
    if let Some(win) = app.get_webview_window(&label) {
        win.set_always_on_top(enabled).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Count active floating card windows (for 10 limit)
#[tauri::command]
pub fn get_floating_card_count(app: AppHandle) -> Result<usize, String> {
    let count = app
        .webview_windows()
        .keys()
        .filter(|k| k.starts_with("floating-"))
        .count();
    Ok(count)
}

/// Get all floating card window labels
#[tauri::command]
pub fn get_floating_card_labels(app: AppHandle) -> Result<Vec<String>, String> {
    let labels: Vec<String> = app
        .webview_windows()
        .keys()
        .filter(|k| k.starts_with("floating-"))
        .map(|k| k.clone())
        .collect();
    Ok(labels)
}
