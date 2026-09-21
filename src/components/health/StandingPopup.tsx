import { Component, createSignal, onMount } from 'solid-js';
import { StretchIcon } from './StretchIcon';
import {
  getStandingConfig,
  pickRandomStretch,
  scheduleNextRemind,
  closeCurrentPopup,
  type StretchGuide,
} from '../../services/health';
import { isTauriEnvironment } from '../../services/tauriAdapter';

/**
 * 久坐/站立提醒弹窗（独立置顶小窗口，右下角滑入）：
 * - 每次随机展示 4 组拉伸动作中的一组（避免与上一次相同）
 * - "知道了"：关闭弹窗并按提醒间隔重置计时器
 * - "5分钟后提醒 ▾"：主按钮=5分钟后再提醒；▾ 展开下拉 10分钟/30分钟（同喝水弹窗）
 * 无进度条、无"今日不再提醒"。
 */
const StandingPopup: Component = () => {
  const [guide, setGuide] = createSignal<StretchGuide | null>(null);
  const [intervalMin, setIntervalMin] = createSignal(60);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [busy, setBusy] = createSignal(false);

  onMount(async () => {
    setGuide(pickRandomStretch());
    if (!isTauriEnvironment()) return;
    try {
      const cfg = await getStandingConfig();
      setIntervalMin(cfg.intervalMin);
    } catch (e) {
      console.warn('[StandingPopup] init failed:', e);
    }
  });

  /** 知道了：关闭并按设定间隔安排下一次提醒 */
  async function handleConfirm() {
    if (busy()) return;
    setBusy(true);
    try {
      scheduleNextRemind('standing', intervalMin());
      await closeCurrentPopup();
    } catch (e) {
      console.warn('[StandingPopup] confirm failed:', e);
      setBusy(false);
    }
  }

  /** 贪睡 N 分钟后再提醒 */
  async function handleSnooze(minutes: number) {
    if (busy()) return;
    setBusy(true);
    try {
      scheduleNextRemind('standing', minutes);
      setMenuOpen(false);
      await closeCurrentPopup();
    } catch (e) {
      console.warn('[StandingPopup] snooze failed:', e);
      setBusy(false);
    }
  }

  return (
    <div class="health-popup-wrap">
      <div class="health-popup-card">
        {/* 站立活动图标 */}
        <div class="health-popup-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="5" r="2.4" fill="#3B82F6" stroke="none" />
            <path d="M12 8.5v6.5" />
            <path d="M12 10.5l-3.5 2.5M12 10.5l3.5 2.5" />
            <path d="M12 15l-2.5 6M12 15l2.5 6" />
          </svg>
        </div>

        <div class="health-popup-message">该起身活动啦！</div>
        <div class="health-popup-tips">久坐伤身，站起来动一动，跟着下面的动作拉伸一下吧</div>

        {/* 随机拉伸动作指导 */}
        {guide() && (
          <div class="standing-stretch-card">
            <div class="standing-stretch-head">
              <StretchIcon name={guide()!.key} />
              <span class="standing-stretch-name">{guide()!.name}</span>
            </div>
            <div class="standing-stretch-desc">{guide()!.desc}</div>
          </div>
        )}

        {/* 按钮行：知道了 + 5分钟后提醒（带下拉） */}
        <div class="health-popup-actions">
          <button class="popup-btn popup-btn-primary" onClick={handleConfirm} disabled={busy()}>
            知道了
          </button>

          <div class="snooze-wrapper">
            <button class="popup-btn popup-btn-secondary" onClick={() => handleSnooze(5)} disabled={busy()}>
              <span>5分钟后提醒</span>
              {/* 三角箭头：与喝水弹窗一致，font-size:30px */}
              <span
                class="snooze-arrow"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
              >▾</span>
            </button>

            <div classList={{ 'snooze-backdrop': true, 'open': menuOpen() }} onClick={() => setMenuOpen(false)} />
            <div classList={{ 'snooze-dropdown': true, 'open': menuOpen() }}>
              <div class="snooze-option" onClick={() => handleSnooze(10)}>10分钟后提醒</div>
              <div class="snooze-option" onClick={() => handleSnooze(30)}>30分钟后提醒</div>
              <div class="snooze-option" onClick={() => handleSnooze(60)}>1小时后提醒</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StandingPopup;
