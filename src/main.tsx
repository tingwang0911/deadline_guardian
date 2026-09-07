import { render } from "solid-js/web";
import "./assets/styles/global.css";
import App from "./App";
import FloatingCard from "./components/FloatingCard";
import ErrorBoundary from "./errors/ErrorBoundary";
import { registerGlobalErrorHandler } from "./errors/errorHandler";

registerGlobalErrorHandler();

// Detect if this is a floating card window via URL params
const urlParams = new URLSearchParams(window.location.search);
const windowType = urlParams.get("window");
const taskId = urlParams.get("task");

if (windowType === "floating" && taskId) {
  // Floating card window - 页面背景必须全透明，否则卡片调透明时无法穿透到桌面
  // （global.css 给 html/body/#root 设了不透明底色，主窗口需要、悬浮窗必须覆盖掉）
  document.documentElement.style.backgroundColor = "transparent";
  document.body.style.backgroundColor = "transparent";
  const rootEl = document.getElementById("root");
  if (rootEl) rootEl.style.backgroundColor = "transparent";

  // Floating card window - render FloatingCard directly
  render(
    () => (
      <ErrorBoundary>
        <FloatingCard taskId={taskId} />
      </ErrorBoundary>
    ),
    document.getElementById("root")!
  );
} else {
  // Main window - render App
  render(
    () => (
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    ),
    document.getElementById("root")!
  );
}
