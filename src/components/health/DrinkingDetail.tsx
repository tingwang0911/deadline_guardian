import { Component, createSignal, onMount, onCleanup, Show } from 'solid-js';
import { Select, Radio, ProgressBar, IntervalInput } from '../ui';
import {
  getDrinkingConfig,
  saveDrinkingConfig,
  getTodayCups,
  CUP_ML_OPTIONS,
  type DrinkingConfig,
  type Gender,
} from '../../services/health';
import { isTauriEnvironment } from '../../services/tauriAdapter';

interface Props {
  onBack: () => void;
}

/**
 * 喝水提醒详情页（健康生活 Tab 内的二级页面）：
 * 提醒间隔 / 杯型容量 / 每日目标杯数 / 性别 → 即时保存 health_configs；
 * 今日饮水进度条来自 water_log（每杯一条，按今日记录数统计）。
 */
const DrinkingDetail: Component<Props> = (props) => {
  const [cfg, setCfg] = createSignal<DrinkingConfig | null>(null);
  const [cups, setCups] = createSignal(0);
  const [saving, setSaving] = createSignal(false);

  async function refresh() {
    if (!isTauriEnvironment()) return;
    try {
      const [c, n] = await Promise.all([getDrinkingConfig(), getTodayCups()]);
      setCfg(c);
      setCups(n);
    } catch (e) {
      console.warn('[DrinkingDetail] refresh failed:', e);
    }
  }

  /** 局部更新并即时保存（所有设置项共用） */
  async function patch(patch: Partial<DrinkingConfig>) {
    if (!isTauriEnvironment()) {
      setCfg((prev) => (prev ? { ...prev, ...patch } : prev));
      return;
    }
    setSaving(true);
    try {
      const merged = await saveDrinkingConfig(patch);
      setCfg(merged);
    } catch (e) {
      console.warn('[DrinkingDetail] save failed:', e);
      window.alert('设置保存失败: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function stepGoal(delta: number) {
    const cur = cfg()?.dailyGoal ?? 8;
    const next = Math.min(20, Math.max(1, cur + delta));
    if (next !== cur) patch({ dailyGoal: next });
  }

  let unsub: (() => void) | undefined;
  onMount(async () => {
    await refresh();
    // 弹窗里点"已喝一杯"后实时刷新进度
    if (isTauriEnvironment()) {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unsub = await listen('water-log-updated', () => {
          void refresh();
        });
      } catch (e) {
        console.warn('[DrinkingDetail] listen failed:', e);
      }
    }
    // 窗口重新激活时刷新（跨天/从弹窗返回）
    window.addEventListener('focus', refresh);
  });

  onCleanup(() => {
    unsub?.();
    window.removeEventListener('focus', refresh);
  });

  const percent = () => {
    const goal = cfg()?.dailyGoal ?? 8;
    return Math.min(100, Math.round((cups() / goal) * 100));
  };

  return (
    <div class="health-detail">
      {/* 顶部：返回 + 标题 */}
      <div class="health-detail-header">
        <button class="health-detail-back" onClick={props.onBack} aria-label="返回" title="返回健康生活">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span class="health-detail-title">喝水提醒</span>
      </div>

      <Show when={cfg()} fallback={<div style={{ padding: '24px', color: 'var(--color-text-secondary)' }}>加载中…</div>}>
        <div class="health-detail-body">
          {/* 今日饮水进度 */}
          <div class="progress-section">
            <div class="progress-label-row">
              <span class="progress-label">今日饮水</span>
              <span class="progress-count">
                今日已喝：<strong>{cups()}</strong> / {cfg()!.dailyGoal} 杯
              </span>
            </div>
            <ProgressBar value={percent()} />
            <div class="progress-hint">每日 00:00 自动重置</div>
          </div>

          {/* 提醒间隔（手动输入分钟数） */}
          <div class="setting-row">
            <div class="setting-label">提醒间隔</div>
            <IntervalInput
              value={cfg()!.intervalMin}
              onChange={(minutes) => patch({ intervalMin: minutes })}
            />
          </div>

          {/* 杯型容量 */}
          <div class="setting-row">
            <div class="setting-label">杯型容量</div>
            <Select
              value={String(cfg()!.cupMl)}
              onChange={(v) => patch({ cupMl: Number(v) })}
              options={CUP_ML_OPTIONS.map((ml) => ({ value: String(ml), label: `${ml}ml` }))}
            />
          </div>

          {/* 每日目标杯数 */}
          <div class="setting-row">
            <div class="setting-label">每日目标杯数</div>
            <div class="number-stepper">
              <button class="stepper-btn" onClick={() => stepGoal(-1)} disabled={cfg()!.dailyGoal <= 1} aria-label="减少">−</button>
              <input class="stepper-input" value={cfg()!.dailyGoal} readonly />
              <button class="stepper-btn" onClick={() => stepGoal(1)} disabled={cfg()!.dailyGoal >= 20} aria-label="增加">+</button>
            </div>
          </div>

          {/* 性别（影响推荐饮水量） */}
          <div class="setting-row">
            <div class="setting-label">性别</div>
            <div class="gender-radios">
              <Radio
                name="drinking-gender"
                value="male"
                label="男"
                checked={cfg()!.gender === 'male'}
                onChange={() => patch({ gender: 'male' as Gender })}
              />
              <Radio
                name="drinking-gender"
                value="female"
                label="女"
                checked={cfg()!.gender === 'female'}
                onChange={() => patch({ gender: 'female' as Gender })}
              />
            </div>
          </div>

          <div class="setting-tips">
            成年男性每日建议至少饮水 1500ml，成年女性约 1200ml（约 7-8 杯白开水）。
          </div>

          <Show when={saving()}>
            <div class="saving-hint">保存中…</div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default DrinkingDetail;
