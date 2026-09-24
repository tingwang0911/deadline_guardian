import { onMount, onCleanup } from 'solid-js';
import {
  refreshDrinkingConfig,
  getStandingConfig,
  getEyecareConfig,
  isSilentToday,
  openDrinkingPopup,
  openStandingPopup,
  triggerEyecare,
  getNextRemindAt,
  scheduleNextRemind,
} from '../services/health';
import { isTauriEnvironment } from '../services/tauriAdapter';

const TICK_MS = 20_000;

/**
 * 健康提醒调度（主窗口内运行）：每 20s 检查一次喝水/久坐两类提醒。
 * - 对应 health_configs.enabled=1（喝水还需今日未静默）；
 * - 到达 nextAt（localStorage 按类型分别记录，各窗口共享）→ 弹出对应弹窗；
 * - 首次运行/无记录时，按提醒间隔安排下一次；
 * - 弹窗内按钮操作会重排 nextAt（贪睡/已完成）或写静默日期（喝水）。
 */
export function useHealthReminders(): void {
  onMount(() => {
    if (!isTauriEnvironment()) return;

    let stopped = false;

    const tickDrinking = async () => {
      try {
        const cfg = await refreshDrinkingConfig();
        if (!cfg.enabled) return;
        if (await isSilentToday()) return;

        const now = Date.now();
        const next = getNextRemindAt('drinking');
        if (!next) {
          scheduleNextRemind('drinking', cfg.intervalMin);
          return;
        }
        if (now >= next) {
          await openDrinkingPopup();
          // 兜底重排：若用户未操作，间隔后再次前置弹窗；弹窗内操作会覆盖此时间
          scheduleNextRemind('drinking', cfg.intervalMin);
        }
      } catch (e) {
        console.warn('[health-reminder] drinking tick failed:', e);
      }
    };

    const tickStanding = async () => {
      try {
        const cfg = await getStandingConfig();
        if (!cfg.enabled) return;

        const now = Date.now();
        const next = getNextRemindAt('standing');
        if (!next) {
          scheduleNextRemind('standing', cfg.intervalMin);
          return;
        }
        if (now >= next) {
          await openStandingPopup();
          scheduleNextRemind('standing', cfg.intervalMin);
        }
      } catch (e) {
        console.warn('[health-reminder] standing tick failed:', e);
      }
    };

    const tickEyecare = async () => {
      try {
        const cfg = await getEyecareConfig();
        if (!cfg.enabled) return;

        const now = Date.now();
        const next = getNextRemindAt('eyecare');
        if (!next) {
          scheduleNextRemind('eyecare', cfg.intervalMin);
          return;
        }
        if (now >= next) {
          // 到期：按配置模式触发（force 模式在 Rust 端检测全屏应用并自动降级通知）
          await triggerEyecare(cfg.mode, cfg.lookDurationSec, cfg.customText);
          // 兜底重排：黑屏/通知本身不重排，由调度器统一按间隔安排下一次
          scheduleNextRemind('eyecare', cfg.intervalMin);
        }
      } catch (e) {
        console.warn('[health-reminder] eyecare tick failed:', e);
      }
    };

    const tick = () => {
      if (stopped) return;
      void tickDrinking();
      void tickStanding();
      void tickEyecare();
    };

    void tick();
    const timer = window.setInterval(tick, TICK_MS);

    onCleanup(() => {
      stopped = true;
      window.clearInterval(timer);
    });
  });
}
