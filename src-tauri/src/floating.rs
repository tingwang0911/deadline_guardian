use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use tauri::{AppHandle, Emitter, LogicalPosition, Manager, WebviewUrl, WebviewWindowBuilder};

/// 悬浮卡片数量上限
const MAX_FLOATING_CARDS: usize = 10;

// ===== 悬浮卡片交互状态（由前端上报，hover watcher 统一消费）=====
// 穿透推导：locked && !panel_open && !main_focused && !cursor_inside
//   - locked：用户锁定卡片位置（常态穿透，不挡下方操作）
//   - panel_open：右键设置面板展开期间必须可交互
//   - main_focused：主窗口在前时，所有卡片临时可交互（沿用既有设计）
//   - cursor_inside：光标悬停在卡片窗口内时临时可交互，
//     这样锁定的卡片也能直接右键打开设置，移开光标即恢复穿透
#[derive(Clone, Copy, Default)]
struct CardState {
    locked: bool,
    panel_open: bool,
}

fn card_states() -> &'static Arc<Mutex<HashMap<String, CardState>>> {
    static STATES: OnceLock<Arc<Mutex<HashMap<String, CardState>>>> = OnceLock::new();
    STATES.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

fn main_focused() -> &'static Arc<Mutex<bool>> {
    static FOCUSED: OnceLock<Arc<Mutex<bool>>> = OnceLock::new();
    FOCUSED.get_or_init(|| Arc::new(Mutex::new(false)))
}

/// 主窗口聚焦/失焦标志（由 main.rs 的 Focused 事件写入）
pub fn set_main_focused(focused: bool) {
    *main_focused().lock().unwrap() = focused;
}

/// 前端上报某张卡片的锁定 / 面板展开状态
#[tauri::command]
pub fn set_floating_card_state(
    _app: AppHandle,
    task_id: String,
    locked: bool,
    panel_open: bool,
) -> Result<(), String> {
    let label = format!("floating-{}", task_id);
    card_states()
        .lock()
        .unwrap()
        .insert(label, CardState { locked, panel_open });
    Ok(())
}

/// 常驻轮询：根据锁定状态、面板展开、主窗口聚焦与光标位置，
/// 统一设置每张悬浮卡片的鼠标穿透（无键盘钩子，仅窗口级 WS_EX_TRANSPARENT 切换）。
pub fn start_hover_watcher(app: AppHandle) {
    #[cfg(windows)]
    hover_watcher_windows(app);
    #[cfg(not(windows))]
    let _ = app;
}

#[cfg(windows)]
fn hover_watcher_windows(app: AppHandle) {
    std::thread::spawn(move || {
        // 本线程记录每张窗口上次应用的穿透态，仅在翻转时下发
        let mut applied: HashMap<String, bool> = HashMap::new();
        loop {
            std::thread::sleep(Duration::from_millis(120));

            use windows::Win32::Foundation::POINT;
            use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

            let mut pt = POINT::default();
            if unsafe { GetCursorPos(&mut pt) }.is_err() {
                continue;
            }
            let focused = *main_focused().lock().unwrap();
            let states = card_states().lock().unwrap().clone();

            for (label, win) in app.webview_windows() {
                if !label.starts_with("floating-") {
                    continue;
                }
                if !win.is_visible().unwrap_or(false) {
                    continue;
                }
                let st = states.get(&label).copied().unwrap_or_default();
                // 未锁定 / 面板展开 / 主窗口在前：一律可交互
                let mut want_through = st.locked && !st.panel_open && !focused;
                if want_through {
                    // 仅锁定穿透态需要判断光标是否悬停在窗口内（物理像素比较）
                    if let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) {
                        let inside = pt.x >= pos.x
                            && pt.x < pos.x + size.width as i32
                            && pt.y >= pos.y
                            && pt.y < pos.y + size.height as i32;
                        if inside {
                            want_through = false;
                        }
                    }
                }
                // 只在状态翻转时调用，避免高频无意义 IPC
                if applied.get(&label) != Some(&want_through) {
                    if win.set_ignore_cursor_events(want_through).is_ok() {
                        applied.insert(label, want_through);
                    }
                }
            }
        }
    });
}

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

/// 按数据库中的锁定状态恢复所有悬浮卡片穿透：
/// 锁定（locked=1）→ 穿透；未锁定 → 不穿透。主窗口隐藏到托盘时调用。
#[tauri::command]
pub fn restore_floating_click_through(app: AppHandle) -> Result<(), String> {
    // 收集每张卡片的 (label, locked)
    let mut states: Vec<(String, bool)> = Vec::new();
    if let Ok(conn) = crate::db::get_connection() {
        for label in app.webview_windows().keys() {
            if let Some(task_id) = label.strip_prefix("floating-") {
                let locked: bool = conn
                    .query_row(
                        "SELECT locked FROM floating_card_configs WHERE task_id = ?1",
                        rusqlite::params![task_id],
                        |row| row.get::<_, i64>(0),
                    )
                    .map(|v| v == 1)
                    .unwrap_or(false);
                states.push((label.clone(), locked));
            }
        }
    } else {
        // DB 不可用时按标签全部恢复为不穿透（安全侧：卡片可交互）
        for label in app.webview_windows().keys() {
            if label.starts_with("floating-") {
                states.push((label.clone(), false));
            }
        }
    }
    for (label, locked) in states {
        if let Some(win) = app.get_webview_window(&label) {
            let _ = win.set_ignore_cursor_events(locked);
        }
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
