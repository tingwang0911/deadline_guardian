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
