//! 系统级功能：开机自启动（Windows 写入 HKCU\Software\Microsoft\Windows\CurrentVersion\Run）。
//!
//! 通过 tauri-plugin-autostart 实现：enable 时把当前 exe 路径写入当前用户的"运行"注册表项，
//! disable 时移除。设置即时生效、无需重启。

use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

/// 开启/关闭开机自启动，返回操作后的实际状态。
#[tauri::command]
pub fn set_auto_start(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|e| e.to_string())?;
    } else {
        manager.disable().map_err(|e| e.to_string())?;
    }
    manager.is_enabled().map_err(|e| e.to_string())
}

/// 读取当前开机自启动状态（供启动时回填 UI）。
#[tauri::command]
pub fn get_auto_start(app: AppHandle) -> Result<bool, bool> {
    app.autolaunch().is_enabled().map_err(|_| false)
}
