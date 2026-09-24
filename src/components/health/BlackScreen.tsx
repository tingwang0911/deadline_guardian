import { createSignal, onCleanup, onMount } from 'solid-js';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriEnvironment } from '../../services/tauriAdapter';
import { DEFAULT_EYECARE_TEXT } from '../../services/health';

/**
 * 护眼远眺强制黑屏（独立全屏置顶窗口，结构严格参照原型 eyecare-blackscreen.html）：
 * - rgba(0,0,0,0.95) 黑底，居中白色提示词；
 * - 160px SVG 圆环倒计时（stroke-dashoffset 随时间走满）+ 居中秒数；
 * - 右下角"退出远眺"按钮：黑屏默认鼠标穿透，仅光标进入按钮热区（Rust 轮询放开）时可点；
 * - 倒计时结束 / 点击退出：500ms 渐隐后关闭窗口。
 */
export default function BlackScreen() {
  const params = new URLSearchParams(window.location.search);
  const totalSec = Math.max(1, Number(params.get('duration')) || 20);
  const promptText = params.get('text') || DEFAULT_EYECARE_TEXT;

  const R = 70;
  const C = 2 * Math.PI * R; // ≈439.82（原型取 440）

  const [remaining, setRemaining] = createSignal(totalSec); // 秒（含小数，用于圆环平滑）
  const [fading, setFading] = createSignal(false);
  const [exitHover, setExitHover] = createSignal(false);

  let timer: number | undefined;
  let unlisten: UnlistenFn | undefined;
  let closed = false;

  /** 500ms 渐隐后关闭窗口（退出按钮 / 倒计时结束共用，只执行一次） */
  async function closeWithFade() {
    if (closed) return;
    closed = true;
    if (timer !== undefined) window.clearInterval(timer);
    setFading(true);
    window.setTimeout(async () => {
      try {
        if (isTauriEnvironment()) await getCurrentWindow().close();
      } catch (e) {
        console.warn('[BlackScreen] close failed:', e);
      }
    }, 500);
  }

  onMount(async () => {
    // Rust 轮询光标：进入"退出远眺"热区时推送 hover 状态（穿透状态下 CSS :hover 不生效）
    if (isTauriEnvironment()) {
      try {
        unlisten = await listen<boolean>('blackscreen-exit-hover', (e) => {
          setExitHover(e.payload === true);
        });
      } catch (e) {
        console.warn('[BlackScreen] listen hover failed:', e);
      }
    }

    const startAt = Date.now();
    timer = window.setInterval(() => {
      const elapsed = (Date.now() - startAt) / 1000;
      const left = Math.max(0, totalSec - elapsed);
      setRemaining(left);
      if (left <= 0) {
        void closeWithFade();
      }
    }, 100);
  });

  onCleanup(() => {
    if (timer !== undefined) window.clearInterval(timer);
    if (unlisten) void unlisten();
  });

  // 圆环剩余比例 → stroke-dashoffset：0（满环）走至 C（空环）
  const dashOffset = () => C * (1 - remaining() / totalSec);

  return (
    <div
      class="blackscreen-root"
      classList={{ 'blackscreen-fading': fading() }}
    >
      <div class="blackscreen-content">
        <div class="blackscreen-text">{promptText}</div>
        <div class="blackscreen-timer">
          <svg width="160" height="160" viewBox="0 0 160 160">
            <circle
              class="blackscreen-ring-bg"
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              stroke-width="4"
            />
            <circle
              class="blackscreen-ring-progress"
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke="#FFFFFF"
              stroke-width="4"
              stroke-linecap="round"
              stroke-dasharray={String(C)}
              stroke-dashoffset={String(dashOffset())}
            />
          </svg>
          <div class="blackscreen-count">{Math.ceil(remaining())}</div>
        </div>
      </div>

      <button
        type="button"
        class="blackscreen-exit-btn"
        classList={{ 'blackscreen-exit-btn-hover': exitHover() }}
        onClick={() => void closeWithFade()}
      >
        退出远眺
      </button>
    </div>
  );
}
