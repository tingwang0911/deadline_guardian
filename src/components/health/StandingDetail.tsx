import { Component, createSignal, onMount, Show, For } from 'solid-js';
import { IntervalInput } from '../ui';
import { StretchIcon } from './StretchIcon';
import {
  getStandingConfig,
  saveStandingConfig,
  STRETCH_GUIDES,
  type StandingConfig,
} from '../../services/health';
import { isTauriEnvironment } from '../../services/tauriAdapter';

interface Props {
  onBack: () => void;
}

/**
 * 久坐/站立提醒详情页（健康生活 Tab 内的二级页面）：
 * 提醒间隔（手动输入分钟）即时保存 health_configs；
 * 4 组拉伸指导预览（文案严格取自原型），提醒弹窗随机展示其中一组。
 */
const StandingDetail: Component<Props> = (props) => {
  const [cfg, setCfg] = createSignal<StandingConfig | null>(null);
  const [saving, setSaving] = createSignal(false);

  onMount(() => {
    if (!isTauriEnvironment()) {
      setCfg({ enabled: true, intervalMin: 60 });
      return;
    }
    getStandingConfig()
      .then(setCfg)
      .catch((e) => console.warn('[StandingDetail] load failed:', e));
  });

  async function patch(p: Partial<StandingConfig>) {
    const optimistic = { ...(cfg() ?? { enabled: true, intervalMin: 60 }), ...p };
    setCfg(optimistic);
    if (!isTauriEnvironment()) return;
    setSaving(true);
    try {
      const saved = await saveStandingConfig(p);
      setCfg(saved);
    } catch (e) {
      console.warn('[StandingDetail] save failed:', e);
      window.alert('设置保存失败: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="health-detail">
      {/* 顶部：返回 + 标题 */}
      <div class="health-detail-header">
        <button class="health-detail-back" onClick={props.onBack} aria-label="返回" title="返回健康生活">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span class="health-detail-title">久坐站立</span>
      </div>

      <Show when={cfg()} fallback={<div style={{ padding: '24px', color: 'var(--color-text-secondary)' }}>加载中…</div>}>
        <div class="health-detail-body">
          {/* 提醒间隔（手动输入分钟数） */}
          <div class="setting-row">
            <div class="setting-label">提醒间隔</div>
            <IntervalInput
              value={cfg()!.intervalMin}
              onChange={(minutes) => patch({ intervalMin: minutes })}
            />
          </div>

          {/* 拉伸指导预览 */}
          <div class="stretch-section">
            <div class="stretch-section-title">拉伸指导预览</div>

            <For each={STRETCH_GUIDES}>
              {(guide) => (
                <div class="stretch-card">
                  <div class="stretch-card-head">
                    <span class="stretch-card-icon">
                      <StretchIcon name={guide.key} />
                    </span>
                    <span class="stretch-name">{guide.name}</span>
                  </div>
                  <div class="stretch-desc">{guide.desc}</div>
                </div>
              )}
            </For>

            <div class="stretch-note">提醒时将随机展示上述拉伸动作指导</div>
          </div>

          <Show when={saving()}>
            <div class="saving-hint">保存中…</div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default StandingDetail;
