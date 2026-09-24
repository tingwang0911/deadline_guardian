//! 护眼/远眺提醒：
//! - 温和模式：Windows 系统通知（toast），不遮挡屏幕；
//! - 强制模式：独立全屏置顶黑屏窗口（95% 不透明），含 SVG 圆环倒计时与"退出远眺"按钮。
//!
//! 全屏检测：当前前台窗口几何边界完整覆盖某台显示器，且不是桌面/任务栏等外壳窗口时，
//! 判定为全屏应用（游戏 / PPT 演示），强制模式自动降级为系统通知。
//!
//! 鼠标穿透：黑屏窗口默认 set_ignore_cursor_events(true)，鼠标点击穿透到下层；
//! 后台线程轮询光标位置，仅当光标位于右下角"退出远眺"按钮热区内时临时取消穿透，
//! 保证按钮可点击，同时向前端推送 hover 状态用于按钮高亮。

use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_notification::NotificationExt;

const BLACKSCREEN_LABEL: &str = "eyecare-blackscreen";

/// 判断当前前台窗口是否为全屏应用（游戏 / 幻灯片演示等）。
/// 在主线程上调用（Manager 的显示器查询需要）。
fn is_foreground_fullscreen(app: &AppHandle) -> bool {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::{HWND, RECT};
        use windows::Win32::UI::WindowsAndMessaging::{
            GetClassNameW, GetForegroundWindow, GetWindowRect,
        };

        unsafe {
            let hwnd: HWND = GetForegroundWindow();
            if hwnd.0.is_null() {
                return false;
            }

            // 排除桌面、任务栏、开始菜单、锁屏等外壳窗口（几何上可能覆盖屏幕但不是全屏应用）
            let mut class_buf = [0u16; 64];
            let len = GetClassNameW(hwnd, &mut class_buf);
            let class = if len > 0 {
                String::from_utf16_lossy(&class_buf[..len as usize])
            } else {
                String::new()
            };
            const SKIP_CLASSES: [&str; 4] =
                ["Progman", "WorkerW", "Shell_TrayWnd", "Windows.UI.Core.CoreWindow"];
            if SKIP_CLASSES.contains(&class.as_str()) {
                return false;
            }

            let mut rect = RECT::default();
            if GetWindowRect(hwnd, &mut rect).is_err() {
                return false;
            }

            // 任一台显示器的物理边界被前台窗口完整覆盖 → 全屏
            if let Ok(monitors) = app.available_monitors() {
                for mon in monitors {
                    let pos = mon.position();
                    let size = mon.size();
                    let left = pos.x;
                    let top = pos.y;
                    let right = pos.x + size.width as i32;
                    let bottom = pos.y + size.height as i32;
                    // 2px 容差，兼容个别全屏窗口边界取整
                    const TOL: i32 = 2;
                    if (rect.left - left).abs() <= TOL
                        && (rect.top - top).abs() <= TOL
                        && (rect.right - right).abs() <= TOL
                        && (rect.bottom - bottom).abs() <= TOL
                    {
                        return true;
                    }
                }
            }
        }
        false
    }

    #[cfg(not(windows))]
    {
        let _ = app;
        false
    }
}

/// 对 URL query 值做百分号编码（中文与保留字符均转义，保证 WebView 正确解析）。
fn percent_encode(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for &b in input.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

/// 发送 Windows 系统通知（温和提醒）。
fn show_gentle_notification(app: &AppHandle, body: &str, degraded: bool) {
    let full_body = if degraded {
        format!("{}（检测到全屏应用，已切换为温和提醒）", body)
    } else {
        body.to_string()
    };
    match app
        .notification()
        .builder()
        .title("护眼提醒")
        .body(&full_body)
        .show()
    {
        Ok(_) => println!("[EYECARE] gentle notification shown"),
        Err(e) => println!("[EYECARE] notification failed: {}", e),
    }
}

/// 创建（或前置）全屏强制黑屏窗口。
fn show_blackscreen(app: &AppHandle, duration_sec: u64, text: &str) {
    if let Some(w) = app.get_webview_window(BLACKSCREEN_LABEL) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        return;
    }

    let url = format!(
        "index.html?window=eyecare-blackscreen&duration={}&text={}",
        duration_sec,
        percent_encode(text)
    );

    let win = match WebviewWindowBuilder::new(app, BLACKSCREEN_LABEL, WebviewUrl::App(url.into()))
        .title("")
        .fullscreen(true)
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .focused(true)
        .build()
    {
        Ok(w) => w,
        Err(e) => {
            println!("[EYECARE] blackscreen build failed: {}", e);
            let _ = app.emit(
                "reminder-popup-failed",
                format!("护眼黑屏窗口创建失败：{}", e),
            );
            return;
        }
    };

    // 默认整窗鼠标穿透；退出按钮热区由轮询线程动态放开
    let _ = win.set_ignore_cursor_events(true);
    println!("[EYECARE] blackscreen created, {}s", duration_sec);

    let app_poll = app.clone();
    std::thread::spawn(move || {
        // 退出按钮热区（逻辑像素）：右下 margin 40，按钮约 116x42，四周 10px 容差
        const MARGIN: f64 = 40.0;
        const BTN_W: f64 = 116.0;
        const BTN_H: f64 = 42.0;
        const SLOP: f64 = 10.0;

        let mut passthrough = true;
        let mut hovering = false;

        loop {
            std::thread::sleep(Duration::from_millis(100));
            let Some(win) = app_poll.get_webview_window(BLACKSCREEN_LABEL) else {
                break;
            };

            let (Ok(pos), Ok(size), Ok(scale)) =
                (win.outer_position(), win.outer_size(), win.scale_factor())
            else {
                continue;
            };

            let to_px = |v: f64| -> i32 { (v * scale) as i32 };
            let win_right = pos.x + size.width as i32;
            let win_bottom = pos.y + size.height as i32;
            let left = win_right - to_px(MARGIN + BTN_W + SLOP);
            let top = win_bottom - to_px(MARGIN + BTN_H + SLOP);
            let right = win_right - to_px(MARGIN - SLOP);
            let bottom = win_bottom - to_px(MARGIN - SLOP);

            #[cfg(windows)]
            {
                use windows::Win32::Foundation::POINT;
                use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

                let inside = unsafe {
                    let mut pt = POINT::default();
                    GetCursorPos(&mut pt)
                        .map(|_| pt.x >= left && pt.x <= right && pt.y >= top && pt.y <= bottom)
                        .unwrap_or(false)
                };

                let want_passthrough = !inside;
                if want_passthrough != passthrough {
                    if win.set_ignore_cursor_events(want_passthrough).is_ok() {
                        passthrough = want_passthrough;
                    }
                }
                if inside != hovering {
                    hovering = inside;
                    let _ = app_poll.emit_to(
                        BLACKSCREEN_LABEL,
                        "blackscreen-exit-hover",
                        inside,
                    );
                }
            }
        }
        println!("[EYECARE] blackscreen cursor poller exited");
    });
}

/// 触发护眼提醒（由主窗口调度器在到期时调用）。
/// - mode="force"：检测到全屏应用时自动降级为系统通知；
/// - mode="gentle"（或其他值）：仅发送系统通知。
#[tauri::command]
pub async fn trigger_eyecare(
    app: AppHandle,
    mode: String,
    duration_sec: u64,
    text: String,
) -> Result<(), String> {
    let app_clone = app.clone();
    app.run_on_main_thread(move || {
        let degraded = is_foreground_fullscreen(&app_clone);
        if mode == "force" && !degraded {
            show_blackscreen(&app_clone, duration_sec.max(1), &text);
        } else {
            show_gentle_notification(&app_clone, &text, degraded && mode == "force");
        }
    })
    .map_err(|e| e.to_string())?;
    Ok(())
}

