import { render } from "solid-js/web";
import "./assets/styles/global.css";
import App from "./App";
import FloatingCard from "./components/FloatingCard";
import DrinkingPopup from "./components/health/DrinkingPopup";
import StandingPopup from "./components/health/StandingPopup";
import BlackScreen from "./components/health/BlackScreen";
import ErrorBoundary from "./errors/ErrorBoundary";
import { registerGlobalErrorHandler } from "./errors/errorHandler";

registerGlobalErrorHandler();

// Detect if this is a floating card window via URL params
const urlParams = new URLSearchParams(window.location.search);
const windowType = urlParams.get("window");
const taskId = urlParams.get("task");

if (windowType === "drinking-popup" || windowType === "standing-popup") {
  // 健康提醒弹窗：无标题栏透明窗口，页面背景必须透明以贴合卡片
  document.documentElement.style.backgroundColor = "transparent";
  document.body.style.backgroundColor = "transparent";
  const rootEl = document.getElementById("root");
  if (rootEl) rootEl.style.backgroundColor = "transparent";

  render(
    () => (
      <ErrorBoundary>
        {windowType === "drinking-popup" ? <DrinkingPopup /> : <StandingPopup />}
      </ErrorBoundary>
    ),
    document.getElementById("root")!
  );
} else if (windowType === "eyecare-blackscreen") {
  // 护眼强制黑屏：透明窗口 + 页面内 rgba(0,0,0,0.95) 黑色层
  document.documentElement.style.backgroundColor = "transparent";
  document.body.style.backgroundColor = "transparent";
  const rootEl = document.getElementById("root");
  if (rootEl) rootEl.style.backgroundColor = "transparent";

  render(
    () => (
      <ErrorBoundary>
        <BlackScreen />
      </ErrorBoundary>
    ),
    document.getElementById("root")!
  );
} else if (windowType === "floating" && taskId) {
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
