use tauri::{AppHandle, LogicalPosition, Manager, WebviewUrl, WebviewWindowBuilder};

/// Create or show a floating card window for a task
#[tauri::command]
pub fn create_floating_card(
    app: AppHandle,
    task_id: String,
    pos_x: Option<f64>,
    pos_y: Option<f64>,
    card_width: Option<f64>,
) -> Result<(), String> {
    let label = format!("floating-{}", task_id);

    // If window already exists, just show it
    if let Some(win) = app.get_webview_window(&label) {
        if !win.is_visible().unwrap_or(false) {
            win.show().map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    let x = pos_x.unwrap_or(20.0);
    let y = pos_y.unwrap_or(20.0);
    let w = card_width.unwrap_or(220.0);

    let url = format!("index.html?window=floating&task={}", task_id);

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title("")
        .inner_size(w, 80.0)
        .position(x, y)
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .build()
        .map_err(|e| e.to_string())?;

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
