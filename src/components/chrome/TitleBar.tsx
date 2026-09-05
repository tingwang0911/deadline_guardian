import { Component } from "solid-js";

const TitleBar: Component = () => {
  const handleMinimize = async () => {
    try {
      const { appWindow } = await import("@tauri-apps/api/window");
      await appWindow.minimize();
    } catch (e) {
      console.log("Tauri not available");
    }
  };

  const handleClose = async () => {
    try {
      const { appWindow } = await import("@tauri-apps/api/window");
      await appWindow.hide();
    } catch (e) {
      console.log("Tauri not available");
    }
  };

  return (
    <div class="titlebar" data-tauri-drag-region>
      <span class="titlebar-title">Deadline Guardian</span>
      <div class="titlebar-controls">
        <button class="titlebar-btn" title="最小化" onClick={handleMinimize}>
          <svg viewBox="0 0 10 1">
            <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </button>
        <button class="titlebar-btn close" title="关闭" onClick={handleClose}>
          <svg viewBox="0 0 10 10">
            <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.5"/>
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
