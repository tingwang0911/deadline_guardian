import { Component, createSignal, onMount } from 'solid-js';
import {
  getDrinkingConfig,
  getTodayCups,
  drinkOneCup,
  setSilentToday,
  scheduleNextRemind,
  closeCurrentPopup,
} from '../../services/health';
import { isTauriEnvironment } from '../../services/tauriAdapter';

/**
 * 喝水提醒弹窗（独立置顶小窗口，右下角滑入）：
 * - "OK 已喝一杯"：写入 water_log（每杯一条，cup_time=当前时间），广播刷新进度，按间隔重排下次提醒
 * - "5分钟后提醒 ▾"：主按钮=5分钟后再提醒；▾（font-size:30px）展开下拉 10分钟/30分钟
 * - "今日不再提醒"：settings.today_silent_date=今天，今日不再弹出（跨天自动失效）
 */
const DrinkingPopup: Component = () => {
  const [cups, setCups] = createSignal(0);
  const [goal, setGoal] = createSignal(8);
  const [genderTip, setGenderTip] = createSignal('成年男性每日建议至少饮水 1500ml，成年女性约 1200ml（约 7-8 杯白开水），少量多次更健康哦。');
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [busy, setBusy] = createSignal(false);

  onMount(async () => {
    if (!isTauriEnvironment()) return;
    try {
      const [c, n] = await Promise.all([getDrinkingConfig(), getTodayCups()]);
      setGoal(c.dailyGoal);
      setCups(n);
      if (c.gender === 'female') {
        setGenderTip('成年女性每日建议饮水约 1200ml（约 7-8 杯白开水），少量多次更健康哦。');
      } else {
        setGenderTip('成年男性每日建议至少饮水 1500ml（约 7-8 杯白开水），少量多次更健康哦。');
      }
    } catch (e) {
      console.warn('[DrinkingPopup] init failed:', e);
    }
  });

  async function notifyLogUpdated() {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().emit('water-log-updated', {});
    } catch (e) {
      console.warn('[DrinkingPopup] emit failed:', e);
    }
  }

  /** OK 已喝一杯 */
  async function handleDrink() {
    if (busy()) return;
    setBusy(true);
    try {
      await drinkOneCup();
      const c = await getDrinkingConfig();
      scheduleNextRemind('drinking', c.intervalMin); // 按设定间隔安排下一次
      await notifyLogUpdated();
      await closeCurrentPopup();
    } catch (e) {
      console.warn('[DrinkingPopup] drink failed:', e);
      setBusy(false);
    }
  }

  /** 贪睡 N 分钟后再提醒 */
  async function handleSnooze(minutes: number) {
    if (busy()) return;
    setBusy(true);
    try {
      scheduleNextRemind('drinking', minutes);
      setMenuOpen(false);
      await closeCurrentPopup();
    } catch (e) {
      console.warn('[DrinkingPopup] snooze failed:', e);
      setBusy(false);
    }
  }

  /** 今日不再提醒 */
  async function handleSilent() {
    if (busy()) return;
    setBusy(true);
    try {
      await setSilentToday();
      await closeCurrentPopup();
    } catch (e) {
      console.warn('[DrinkingPopup] silent failed:', e);
      setBusy(false);
    }
  }

  return (
    <div class="health-popup-wrap">
      <div class="health-popup-card">
        {/* 水滴图标 */}
        <div class="health-popup-icon">
          <svg width="48" height="48" viewBox="0 0 24 24">
            <path
              d="M12 2.5S5.5 9.9 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 9.9 12 2.5 12 2.5z"
              fill="#3B82F6"
            />
            <path d="M9.2 14.2a2.8 2.8 0 0 0 2.1 2.7" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.85" />
          </svg>
        </div>

        <div class="health-popup-message">该喝水啦！</div>
        <div class="health-popup-tips">{genderTip()}</div>

        <div class="drinking-popup-progress">
          今日已喝 <strong>{cups()}</strong> / {goal()} 杯
        </div>

        {/* 按钮行：OK + 5分钟后提醒（带下拉） */}
        <div class="health-popup-actions">
          <button class="popup-btn popup-btn-primary" onClick={handleDrink} disabled={busy()}>
            OK 已喝一杯
          </button>

          <div class="snooze-wrapper">
            <button class="popup-btn popup-btn-secondary" onClick={() => handleSnooze(5)} disabled={busy()}>
              <span>5分钟后提醒</span>
              {/* 三角箭头：原型明确指定 font-size:30px，勿改 */}
              <span
                class="snooze-arrow"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
              >▾</span>
            </button>

            {/* 下拉菜单：CSS 过渡展开，点外部关闭 */}
            <div classList={{ 'snooze-backdrop': true, 'open': menuOpen() }} onClick={() => setMenuOpen(false)} />
            <div classList={{ 'snooze-dropdown': true, 'open': menuOpen() }}>
              <div class="snooze-option" onClick={() => handleSnooze(10)}>10分钟后提醒</div>
              <div class="snooze-option" onClick={() => handleSnooze(30)}>30分钟后提醒</div>
            </div>
          </div>
        </div>

        <button class="popup-btn-silent" onClick={handleSilent} disabled={busy()}>
          今日不再提醒
        </button>
      </div>
    </div>
  );
};

export default DrinkingPopup;
