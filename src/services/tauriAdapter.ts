import { invoke as tauriInvoke } from '@tauri-apps/api/core';

export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).__TAURI_INTERNALS__;
}

export async function safeInvoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriEnvironment()) {
    throw new Error(
      '当前运行在浏览器环境中，无法调用后端接口。\n' +
      '请在 Tauri 应用窗口中使用此功能。\n\n' +
      '提示：按 Alt+Tab 切换到 Deadline Guardian 窗口，\n' +
      '或双击系统托盘图标打开窗口。'
    );
  }
  return tauriInvoke(command, args) as Promise<T>;
}
