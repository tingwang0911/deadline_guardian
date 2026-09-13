import { Component, createSignal, createMemo, createEffect, onMount, onCleanup, Show, For } from 'solid-js';
import { useCountdown } from '../hooks/useCountdown';
import {
  query,
  execute,
  type Task,
  type FloatingCardConfig,
} from '../services/db';
import {
  setClickThrough,
  setFloatingAlwaysOnTop,
  closeFloatingCard,
} from '../services/floatingCard';
import { isTauriEnvironment } from '../services/tauriAdapter';

// ===== 尺寸常量 =====
const CARD_H = 96;          // 卡片常态高度
const PANEL_W = 272;        // 设置面板展开后的窗口宽度
const PANEL_H = 445;        // 设置面板高度（窗口展开高度 = CARD_H + PANEL_H）

// ===== 默认样式（新卡片首次创建时使用） =====
const DEFAULTS = {
  card_width: 220,
  font_size: 14,
  text_color: '#FFFFFF',
  stroke_color: '#000000',
  stroke_width: 0,
  bg_color: '#1F2937',
  bg_opacity: 0.55,
  locked: 0,
  always_on_top: 1,
};

// ===== 颜色预设 =====
const TEXT_COLOR_PRESETS = ['#FFFFFF', '#FCA5A5', '#FDE047', '#86EFAC', '#7DD3FC', '#C4B5FD', '#111827'];
const BG_COLOR_PRESETS = ['#1F2937', '#111827', '#0F172A', '#7F1D1D', '#14532D', '#1E3A8A'];

// ===== 工具函数 =====
function hexToRgba(hex: string, alpha: number): string {
  let h = (hex || '#000000').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

/** 用多层 text-shadow 模拟文字描边（WebView2/Chromium 兼容，描边在文字下层不压字） */
function outlineShadow(width: number, color: string): string {
  if (!width || width <= 0) return 'none';
  const steps = Math.max(1, Math.ceil(width));
  const delta = width / steps;
  const parts: string[] = [];
  for (let i = -steps; i <= steps; i++) {
    for (let j = -steps; j <= steps; j++) {
      if (i === 0 && j === 0) continue;
      parts.push(`${(i * delta).toFixed(2)}px ${(j * delta).toFixed(2)}px 0 ${color}`);
    }
  }
  return parts.join(', ');
}

// ===== 颜色取色按钮：圆形色块直接显示当前生效颜色，点击弹出原生取色器 =====
const ColorButton: Component<{
  value: string;
  title: string;
  onChange: (color: string) => void;
}> = (props) => (
  <label class="fc-color-btn" title={props.title} style={{ background: props.value }}>
    <input
      type="color"
      value={props.value}
      onInput={(e) => props.onChange((e.target as HTMLInputElement).value)}
    />
  </label>
);

// ===== 卡片内容（含倒计时与设置面板） =====
const FloatingCardContent: Component<{
  task: Task;
  taskId: string;
  initial: FloatingCardConfig | null;
}> = (props) => {
  const countdown = useCountdown(props.task.deadline, props.task.status);

  // ---- 样式信号（从配置初始化） ----
  const [cardWidth] = createSignal(props.initial?.card_width ?? DEFAULTS.card_width);
  const [fontSize, setFontSize] = createSignal(props.initial?.font_size ?? DEFAULTS.font_size);
  const [textColor, setTextColor] = createSignal(props.initial?.text_color ?? DEFAULTS.text_color);
  const [strokeColor, setStrokeColor] = createSignal(props.initial?.stroke_color ?? DEFAULTS.stroke_color);
  const [strokeWidth, setStrokeWidth] = createSignal(props.initial?.stroke_width ?? DEFAULTS.stroke_width);
  const [bgColor, setBgColor] = createSignal(props.initial?.bg_color ?? DEFAULTS.bg_color);
  const [bgOpacity, setBgOpacity] = createSignal(props.initial?.bg_opacity ?? DEFAULTS.bg_opacity);
  const [locked, setLocked] = createSignal((props.initial?.locked ?? DEFAULTS.locked) === 1);
  const [alwaysOnTop, setAlwaysOnTop] = createSignal((props.initial?.always_on_top ?? DEFAULTS.always_on_top) === 1);
  const [panelOpen, setPanelOpen] = createSignal(false);

  // ---- 持久化（防抖 + 每字段单条 UPDATE，参数少、稳妥） ----
  const pendingPatch: Record<string, unknown> = {};
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  function persist(field: string, value: unknown) {
    pendingPatch[field] = value;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const patch = { ...pendingPatch };
      for (const k of Object.keys(pendingPatch)) delete pendingPatch[k];
      void flushPersist(patch);
    }, 300);
  }
  async function flushPersist(patch: Record<string, unknown>) {
    try {
      for (const [k, v] of Object.entries(patch)) {
        await execute(`UPDATE floating_card_configs SET ${k} = ? WHERE task_id = ?`, [v, props.taskId]);
      }
    } catch (e) {
      console.error('[FloatingCard] persist failed:', e);
    }
  }

  // ---- 倒计时紧急程度 ----
  const urgencyLevel = createMemo(() => countdown.state().level);
  const isUrgent = createMemo(() => urgencyLevel() === 'urgent' || urgencyLevel() === 'overdue');
  const isWarning = createMemo(() => urgencyLevel() === 'warning');

  const cardBorder = createMemo(() => {
    if (isUrgent()) return '1.5px solid rgba(239, 68, 68, 0.95)';
    if (isWarning()) return '1.5px solid rgba(245, 158, 11, 0.9)';
    return '1.5px solid rgba(255, 255, 255, 0.22)';
  });

  const titleStyle = createMemo(() => ({
    'font-size': `${fontSize()}px`,
    color: textColor(),
    'font-weight': 700,
    'line-height': 1.35,
    'word-break': 'break-all' as const,
    'text-shadow': outlineShadow(strokeWidth(), strokeColor()),
  }));
  const countdownStyle = createMemo(() => ({
    'font-size': `${Math.max(10, fontSize() - 3)}px`,
    color: hexToRgba(textColor(), 0.85),
    'font-weight': isUrgent() ? 700 : 500,
    'text-shadow': outlineShadow(strokeWidth(), strokeColor()),
  }));

  // ===== 原生拖拽（左键按住卡片即可拖动；固定后禁用） =====
  async function handleCardMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    if (locked()) return;
    if (!isTauriEnvironment()) return;
    e.preventDefault();
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().startDragging();
    } catch (err) {
      console.error('[FloatingCard] startDragging failed:', err);
    }
  }

  // ===== 右键：展开/收起设置面板（窗口同步缩放，一屏完成所有操作） =====
  async function setPanel(open: boolean) {
    setPanelOpen(open);
    if (!isTauriEnvironment()) return;
    try {
      const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.setSize(
        new LogicalSize(open ? PANEL_W : cardWidth(), open ? CARD_H + PANEL_H : CARD_H)
      );
    } catch (err) {
      console.error('[FloatingCard] setSize failed:', err);
    }
  }
  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    void setPanel(!panelOpen());
  }

  // ===== 点击穿透：固定(locked)模式且面板未展开时穿透（点击落到下方窗口）；
  // 可拖拽模式、或右键面板展开时必须可交互。locked/panelOpen 是唯一状态源 =====
  createEffect(() => {
    const through = locked() && !panelOpen();
    if (!isTauriEnvironment()) return;
    void setClickThrough(props.taskId, through);
  });

  // ===== 开关动作 =====
  async function toggleLocked() {
    const next = !locked();
    setLocked(next);
    persist('locked', next ? 1 : 0);
    // 穿透状态由上面的 createEffect 统一联动，无需在此单独调用
  }
  async function toggleAlwaysOnTop() {
    const next = !alwaysOnTop();
    setAlwaysOnTop(next);
    persist('always_on_top', next ? 1 : 0);
    try {
      await setFloatingAlwaysOnTop(props.taskId, next);
    } catch (e) {
      console.error('[FloatingCard] toggle on top failed:', e);
    }
  }

  // ===== 卡片动作 =====
  async function doCompleteTask() {
    try {
      const now = new Date().toISOString();
      await execute(
        "UPDATE tasks SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?",
        [now, now, props.taskId]
      );
      if (isTauriEnvironment()) {
        const { emit } = await import('@tauri-apps/api/event');
        await emit('task-completed-celebration', { taskId: props.taskId });
      }
      await closeFloatingCard(props.taskId);
    } catch (e) {
      console.error('[FloatingCard] complete task failed:', e);
    }
  }
  async function doHideCard() {
    try {
      await execute('UPDATE tasks SET show_floating = 0 WHERE id = ?', [props.taskId]);
      // 必须销毁窗口而非仅 hide()：hide 的窗口仍占用 Rust 端 10 张上限名额，
      // 会导致之后新卡片全部被上限拒绝。show_floating 已置 0，重启不会恢复；
      // 想重新显示，在主窗口编辑任务时勾选"在桌面显示悬浮任务卡片"即可。
      await closeFloatingCard(props.taskId);
    } catch (e) {
      console.error('[FloatingCard] hide failed:', e);
    }
  }

  return (
    <div
      style={{
        width: panelOpen() ? `${PANEL_W}px` : `${cardWidth()}px`,
        background: 'transparent',
        'font-family': "'Microsoft YaHei', 'PingFang SC', sans-serif",
      }}
    >
      {/* ===== 悬浮卡片本体 ===== */}
      <div
        style={{
          position: 'relative',
          width: `${cardWidth()}px`,
          height: `${CARD_H}px`,
          padding: '12px 14px',
          'box-sizing': 'border-box',
          background: hexToRgba(bgColor(), bgOpacity()),
          'backdrop-filter': 'blur(6px)',
          '-webkit-backdrop-filter': 'blur(6px)',
          'border-radius': '12px',
          border: cardBorder(),
          cursor: locked() ? 'default' : 'move',
          'user-select': 'none',
          overflow: 'hidden',
          transition: 'border 0.2s ease',
        }}
        classList={{ 'fc-urgent-pulse': isUrgent() }}
        onMouseDown={handleCardMouseDown}
        onContextMenu={handleContextMenu}
        title="左键拖动位置 · 右键打开设置"
      >
        <div style={titleStyle()}>{props.task.title}</div>
        <div style={{ ...countdownStyle(), 'margin-top': '4px' }}>{countdown.state().text}</div>

        <Show when={locked()}>
          <span style={{ position: 'absolute', top: '4px', right: '8px', 'font-size': '11px', opacity: 0.85 }}>🔒</span>
        </Show>

        <Show when={isUrgent()}>
          <style>{`
            @keyframes fc-pulse {
              0%, 100% { box-shadow: 0 0 8px rgba(239, 68, 68, 0.35); }
              50% { box-shadow: 0 0 22px rgba(239, 68, 68, 0.65); }
            }
            .fc-urgent-pulse { animation: fc-pulse 1.2s ease-in-out infinite; }
          `}</style>
        </Show>
      </div>

      {/* ===== 一屏式设置面板（右键展开，零跳转） ===== */}
      <Show when={panelOpen()}>
        <div
          style={{
            width: `${PANEL_W}px`,
            'margin-top': '8px',
            background: '#FFFFFF',
            'border-radius': '12px',
            padding: '12px 14px',
            'box-sizing': 'border-box',
            'box-shadow': '0 10px 28px rgba(0,0,0,0.35)',
            color: '#111827',
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* 头部 */}
          <div style={{ display: 'flex', 'align-items': 'center', 'margin-bottom': '8px' }}>
            <span style={{ 'font-size': '13px', 'font-weight': 700, flex: 1 }}>卡片设置</span>
            <span style={{ 'font-size': '10px', color: '#9CA3AF', 'margin-right': '8px' }}>右键卡片收起</span>
            <button
              onClick={() => void setPanel(false)}
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer',
                'font-size': '14px', color: '#6B7280', padding: '2px 6px',
              }}
            >✕</button>
          </div>

          {/* 字号 */}
          <div class="fc-field">
            <div class="fc-field-label">
              <span>字号</span>
              <span class="fc-field-value">{fontSize()}px</span>
            </div>
            <input
              class="fc-range"
              type="range" min="12" max="28" step="1" value={fontSize()}
              onInput={(e) => {
                const v = parseInt((e.target as HTMLInputElement).value, 10);
                setFontSize(v);
                persist('font_size', v);
              }}
            />
          </div>

          {/* 字体颜色 */}
          <div class="fc-field">
            <div class="fc-field-label"><span>字体颜色</span></div>
            <div style={{ display: 'flex', gap: '6px', 'align-items': 'center', 'flex-wrap': 'wrap' }}>
              <For each={TEXT_COLOR_PRESETS}>
                {(c) => (
                  <button
                    class="fc-swatch"
                    title={c}
                    style={{
                      background: c,
                      outline: textColor().toLowerCase() === c.toLowerCase() ? '2px solid #DC2626' : '1px solid rgba(0,0,0,0.15)',
                    }}
                    onClick={() => { setTextColor(c); persist('text_color', c); }}
                  />
                )}
              </For>
              <ColorButton
                title="自定义字体颜色"
                value={textColor()}
                onChange={(v) => { setTextColor(v); persist('text_color', v); }}
              />
            </div>
          </div>

          {/* 字体描边 */}
          <div class="fc-field">
            <div class="fc-field-label">
              <span>字体描边</span>
              <span class="fc-field-value">{strokeWidth() === 0 ? '无' : `${strokeWidth()}px`}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', 'align-items': 'center' }}>
              <input
                class="fc-range"
                style={{ flex: 1 }}
                type="range" min="0" max="4" step="0.5" value={strokeWidth()}
                onInput={(e) => {
                  const v = parseFloat((e.target as HTMLInputElement).value);
                  setStrokeWidth(v);
                  persist('stroke_width', v);
                }}
              />
              <span style={{ 'font-size': '10px', color: '#9CA3AF', 'flex-shrink': 0 }}>描边色</span>
              <ColorButton
                title="描边颜色（控制文字轮廓线）"
                value={strokeColor()}
                onChange={(v) => {
                  setStrokeColor(v);
                  persist('stroke_color', v);
                  // 宽度为 0 时选颜色看不到效果，自动给一个默认描边宽度
                  if (strokeWidth() === 0) {
                    setStrokeWidth(1.5);
                    persist('stroke_width', 1.5);
                  }
                }}
              />
            </div>
          </div>

          {/* 背景与透明度 */}
          <div class="fc-field">
            <div class="fc-field-label"><span>背景颜色</span></div>
            <div style={{ display: 'flex', gap: '6px', 'align-items': 'center', 'flex-wrap': 'wrap', 'margin-bottom': '6px' }}>
              <For each={BG_COLOR_PRESETS}>
                {(c) => (
                  <button
                    class="fc-swatch"
                    title={c}
                    style={{
                      background: c,
                      outline: bgColor().toLowerCase() === c.toLowerCase() ? '2px solid #DC2626' : '1px solid rgba(0,0,0,0.15)',
                    }}
                    onClick={() => { setBgColor(c); persist('bg_color', c); }}
                  />
                )}
              </For>
              <ColorButton
                title="自定义背景底色"
                value={bgColor()}
                onChange={(v) => { setBgColor(v); persist('bg_color', v); }}
              />
            </div>
            <div class="fc-field-label">
              <span>背景透明（0% 实色 → 100% 全透明）</span>
              <span class="fc-field-value">{Math.round((1 - bgOpacity()) * 100)}%</span>
            </div>
            <input
              class="fc-range"
              type="range" min="0" max="100" step="5" value={Math.round((1 - bgOpacity()) * 100)}
              onInput={(e) => {
                // 滑块语义是"透明度"：100% = 完全透明（alpha 0）；库内存 alpha 不透明度
                const transparency = parseInt((e.target as HTMLInputElement).value, 10) / 100;
                const alpha = 1 - transparency;
                setBgOpacity(alpha);
                persist('bg_opacity', alpha);
              }}
            />
          </div>

          {/* 开关：固定位置 / 始终置顶 */}
          <div style={{ 'border-top': '1px solid #F3F4F6', 'margin-top': '8px', 'padding-top': '4px' }}>
            <div class="fc-switch-row" onClick={() => void toggleLocked()}>
              <span style={{ flex: 1 }}>固定位置（锁定不可拖动）</span>
              <span class="fc-switch" classList={{ 'fc-switch-on': locked() }}>
                <span class="fc-switch-knob" />
              </span>
            </div>
            <div class="fc-switch-row" onClick={() => void toggleAlwaysOnTop()}>
              <span style={{ flex: 1 }}>始终置顶</span>
              <span class="fc-switch" classList={{ 'fc-switch-on': alwaysOnTop() }}>
                <span class="fc-switch-knob" />
              </span>
            </div>
          </div>

          {/* 动作按钮 */}
          <div style={{ display: 'flex', gap: '8px', 'margin-top': '10px' }}>
            <button
              class="fc-btn fc-btn-primary"
              onClick={() => void doCompleteTask()}
            >完成任务</button>
            <button
              class="fc-btn"
              onClick={() => void doHideCard()}
            >隐藏卡片</button>
          </div>

          <style>{`
            .fc-field { margin: 9px 0; }
            .fc-field-label {
              display: flex; justify-content: space-between; align-items: center;
              font-size: 11px; color: #6B7280; margin-bottom: 4px;
            }
            .fc-field-value { color: #111827; font-weight: 600; }
            .fc-range {
              width: 100%; height: 4px; -webkit-appearance: none; appearance: none;
              background: #E5E7EB; border-radius: 2px; outline: none; margin: 0;
            }
            .fc-range::-webkit-slider-thumb {
              -webkit-appearance: none; appearance: none;
              width: 14px; height: 14px; border-radius: 50%;
              background: #DC2626; cursor: pointer; border: 2px solid #fff;
              box-shadow: 0 1px 3px rgba(0,0,0,0.25);
            }
            .fc-swatch {
              width: 20px; height: 20px; border-radius: 50%; padding: 0;
              cursor: pointer; border: none;
            }
            /* 自定义取色按钮：圆形色块直接显示当前颜色，原生取色器透明覆盖其上 */
            .fc-color-btn {
              position: relative; width: 24px; height: 24px; border-radius: 50%;
              border: 2px solid #FFFFFF; box-shadow: 0 0 0 1px rgba(0,0,0,0.3);
              cursor: pointer; display: inline-block; overflow: hidden;
              flex-shrink: 0; padding: 0;
            }
            .fc-color-btn:hover { transform: scale(1.12); }
            .fc-color-btn input {
              position: absolute; inset: 0; width: 100%; height: 100%;
              opacity: 0; cursor: pointer; border: none; padding: 0;
            }
            .fc-switch-row {
              display: flex; align-items: center; gap: 8px;
              padding: 7px 0; cursor: pointer; font-size: 12px; color: #374151;
            }
            .fc-switch {
              width: 34px; height: 19px; border-radius: 10px; background: #D1D5DB;
              position: relative; flex-shrink: 0; transition: background 0.15s ease;
            }
            .fc-switch-on { background: #DC2626; }
            .fc-switch-knob {
              position: absolute; top: 2px; left: 2px;
              width: 15px; height: 15px; border-radius: 50%; background: #fff;
              transition: left 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.2);
            }
            .fc-switch-on .fc-switch-knob { left: 17px; }
            .fc-btn {
              flex: 1; padding: 7px 0; border-radius: 8px; font-size: 12px;
              border: 1px solid #E5E7EB; background: #F9FAFB; color: #374151; cursor: pointer;
            }
            .fc-btn:hover { background: #F3F4F6; }
            .fc-btn-primary { background: #DC2626; border-color: #DC2626; color: #fff; font-weight: 600; }
            .fc-btn-primary:hover { background: #B91C1C; }
          `}</style>
        </div>
      </Show>
    </div>
  );
};

// ===== 外层组件：加载任务与配置，挂载后恢复窗口状态 =====
const FloatingCard: Component<{ taskId: string }> = (props) => {
  const [task, setTask] = createSignal<Task | null>(null);
  const [config, setConfig] = createSignal<FloatingCardConfig | null>(null);
  const [loaded, setLoaded] = createSignal(false);

  onMount(async () => {
    if (!isTauriEnvironment()) {
      // 浏览器预览兜底：显示一个假任务，便于看样式
      setTask({
        id: props.taskId, title: '示例任务（浏览器预览）', deadline: new Date(Date.now() + 3600_000).toISOString(),
        status: 'pending', tags: '[]', show_floating: 1, completed_at: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      setLoaded(true);
      return;
    }
    try {
      const tasks = await query<Task>('SELECT * FROM tasks WHERE id = ?', [props.taskId]);
      if (tasks.length > 0) setTask(tasks[0]);

      let cfg: FloatingCardConfig | null = null;
      const configs = await query<FloatingCardConfig>(
        'SELECT * FROM floating_card_configs WHERE task_id = ?',
        [props.taskId]
      );
      if (configs.length > 0) {
        cfg = configs[0];
        setConfig(cfg);
      } else {
        // 首次显示：写入默认配置（SQL 内写死默认值，仅 1 个参数）
        await execute(
          `INSERT INTO floating_card_configs
            (task_id, pos_x, pos_y, card_width, font_family, font_size, font_bold,
             text_color, stroke_color, stroke_width, bg_color, bg_opacity, locked,
             always_on_top, click_through, monitor_index)
           VALUES (?, 20, 20, 220, 'Microsoft YaHei', 14, 1,
                   '#FFFFFF', '#000000', 0, '#1F2937', 0.55, 0, 1, 0, 0)`,
          [props.taskId]
        );
      }

      const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();

      // 校正窗口尺寸（Rust 创建时是默认尺寸）
      await win.setSize(new LogicalSize(cfg?.card_width ?? DEFAULTS.card_width, CARD_H));

      // 恢复置顶状态；点击穿透由 createEffect 按 locked 状态统一推导
      if (cfg && cfg.always_on_top === 0) {
        await setFloatingAlwaysOnTop(props.taskId, false);
      }

      // 拖拽结束后持久化位置（监听窗口移动，防抖写入；用逻辑坐标保证跨 DPI 一致）
      let moveTimer: ReturnType<typeof setTimeout> | undefined;
      const unlistenMoved = await win.onMoved(() => {
        if (moveTimer) clearTimeout(moveTimer);
        moveTimer = setTimeout(async () => {
          try {
            const pos = await win.outerPosition();
            const factor = await win.scaleFactor();
            await execute(
              'UPDATE floating_card_configs SET pos_x = ?, pos_y = ? WHERE task_id = ?',
              [Math.round(pos.x / factor), Math.round(pos.y / factor), props.taskId]
            );
          } catch (e) {
            console.error('[FloatingCard] persist position failed:', e);
          }
        }, 500);
      });
      onCleanup(() => {
        unlistenMoved();
        if (moveTimer) clearTimeout(moveTimer);
      });

      setLoaded(true);
    } catch (e) {
      console.error('[FloatingCard] load failed:', e);
      setLoaded(true);
    }
  });

  return (
    <Show when={loaded() && task()} fallback={<div style={{ width: '220px', height: `${CARD_H}px` }} />}>
      <FloatingCardContent task={task()!} taskId={props.taskId} initial={config()} />
    </Show>
  );
};

export default FloatingCard;
