import { Component, createSignal, createMemo, onMount, onCleanup, Show, For } from 'solid-js';
import { useCountdown } from '../hooks/useCountdown';
import {
  query,
  execute,
  type Task,
  type FloatingCardConfig,
} from '../services/db';
import {
  setFloatingPosition,
  setClickThrough,
  setFloatingAlwaysOnTop,
  closeFloatingCard,
} from '../services/floatingCard';
import { isTauriEnvironment } from '../services/tauriAdapter';

// ===== Constants =====
const CARD_SIZES = { small: 180, medium: 220, large: 280 } as const;
type CardSize = keyof typeof CARD_SIZES;

// ===== Inner content component (has countdown) =====
const FloatingCardContent: Component<{
  task: Task;
  config: FloatingCardConfig | null;
  taskId: string;
}> = (props) => {
  const countdown = useCountdown(props.task.deadline, props.task.status);

  const [dragging, setDragging] = createSignal(false);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [menuPos, setMenuPos] = createSignal({ x: 0, y: 0 });
  const [submenuOpen, setSubmenuOpen] = createSignal(false);
  const [cardSize, setCardSize] = createSignal<CardSize>(
    props.config
      ? props.config.card_width <= 190
        ? 'small'
        : props.config.card_width >= 260
        ? 'large'
        : 'medium'
      : 'medium'
  );
  const [alwaysOnTop, setAlwaysOnTop] = createSignal(props.config?.always_on_top !== 0);
  const [clickThrough, setClickThroughState] = createSignal(props.config?.click_through === 1);

  let dragStart = { x: 0, y: 0 };
  let winStart = { x: 0, y: 0 };

  const urgencyLevel = createMemo(() => countdown.state().level);
  const cardClass = createMemo(() => {
    const level = urgencyLevel();
    if (level === 'overdue' || level === 'urgent') return 'card-urgent';
    if (level === 'warning') return 'card-warning';
    return 'card-normal';
  });
  const cardWidth = createMemo(() => CARD_SIZES[cardSize()]);

  // ===== Context menu =====
  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
    setSubmenuOpen(false);
  }
  function closeMenu() { setMenuOpen(false); setSubmenuOpen(false); }

  // ===== Menu actions =====
  async function doCompleteTask() {
    closeMenu();
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
    } catch (e) { console.error('[FloatingCard] complete task failed:', e); }
  }

  async function doHideCard() {
    closeMenu();
    try {
      await execute('UPDATE tasks SET show_floating = 0 WHERE id = ?', [props.taskId]);
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().hide();
    } catch (e) { console.error('[FloatingCard] hide failed:', e); }
  }

  async function doToggleAlwaysOnTop() {
    closeMenu();
    const next = !alwaysOnTop();
    setAlwaysOnTop(next);
    try {
      await setFloatingAlwaysOnTop(props.taskId, next);
      await execute(
        'UPDATE floating_card_configs SET always_on_top = ? WHERE task_id = ?',
        [next ? 1 : 0, props.taskId]
      );
    } catch (e) { console.error('[FloatingCard] toggle on top failed:', e); }
  }

  async function doToggleClickThrough() {
    closeMenu();
    const next = !clickThrough();
    setClickThroughState(next);
    try {
      await setClickThrough(props.taskId, next);
      await execute(
        'UPDATE floating_card_configs SET click_through = ? WHERE task_id = ?',
        [next ? 1 : 0, props.taskId]
      );
    } catch (e) { console.error('[FloatingCard] toggle click through failed:', e); }
  }

  function doToggleDrag() { closeMenu(); setDragging(!dragging()); }

  async function doSetSize(sz: CardSize) {
    closeMenu();
    setCardSize(sz);
    const w = CARD_SIZES[sz];
    try {
      if (isTauriEnvironment()) {
        const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
        await getCurrentWindow().setSize(new LogicalSize(w, 80));
      }
      await execute(
        'UPDATE floating_card_configs SET card_width = ? WHERE task_id = ?',
        [w, props.taskId]
      );
    } catch (e) { console.error('[FloatingCard] set size failed:', e); }
  }

  // ===== Drag =====
  async function handleMouseDown(e: MouseEvent) {
    if (!dragging() || e.button !== 0) return;
    e.preventDefault();
    dragStart = { x: e.screenX, y: e.screenY };
    if (isTauriEnvironment()) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const pos = await getCurrentWindow().outerPosition();
      winStart = { x: pos.x, y: pos.y };
    }
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }
  async function handleMouseMove(e: MouseEvent) {
    if (!dragging()) return;
    const dx = e.screenX - dragStart.x;
    const dy = e.screenY - dragStart.y;
    await setFloatingPosition(props.taskId, winStart.x + dx, winStart.y + dy);
  }
  async function handleMouseUp() {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    try {
      if (isTauriEnvironment()) {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const pos = await getCurrentWindow().outerPosition();
        await execute(
          'UPDATE floating_card_configs SET pos_x = ?, pos_y = ? WHERE task_id = ?',
          [pos.x, pos.y, props.taskId]
        );
      }
    } catch (e) { console.error('[FloatingCard] persist position failed:', e); }
    setDragging(false);
  }
  onCleanup(() => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  });

  // ===== Menu items =====
  const menuItems = [
    { id: 'complete', label: '完成任务', onClick: doCompleteTask },
    { id: 'hide', label: '隐藏卡片', onClick: doHideCard },
    { id: 'text-props', label: '文字属性', onClick: () => closeMenu() },
    { id: 'size', label: '文字位置与大小', hasSubmenu: true },
    { id: 'div1', label: '', divider: true },
    { id: 'top', label: '始终置顶', checked: () => alwaysOnTop(), onClick: doToggleAlwaysOnTop },
    { id: 'through', label: '点击穿透', checked: () => clickThrough(), onClick: doToggleClickThrough },
  ];

  const sizeSubMenu = [
    { id: 'drag', label: '拖拽移动位置', checked: () => dragging(), onClick: doToggleDrag },
    { id: 'small', label: '小（180px 宽）', checked: () => cardSize() === 'small', onClick: () => doSetSize('small') },
    { id: 'medium', label: '中（220px 宽）', checked: () => cardSize() === 'medium', onClick: () => doSetSize('medium') },
    { id: 'large', label: '大（280px 宽）', checked: () => cardSize() === 'large', onClick: () => doSetSize('large') },
  ];

  return (
    <div
      style={{
        width: `${cardWidth()}px`,
        padding: '16px',
        background: 'transparent',
        'border-radius': '8px',
        position: 'relative',
        border: dragging()
          ? '2px dashed rgba(255,255,255,0.6)'
          : cardClass() === 'card-urgent'
          ? '2px solid rgba(239, 68, 68, 0.9)'
          : cardClass() === 'card-warning'
          ? '2px solid rgba(245, 158, 11, 0.9)'
          : '2px solid transparent',
        cursor: dragging() ? 'move' : 'default',
        transition: 'width 0.2s ease, border 0.2s ease',
        'user-select': 'none',
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      classList={{ 'card-urgent-pulse': cardClass() === 'card-urgent' }}
    >
      <div
        style={{
          'font-size': '13px',
          'font-weight': '600',
          color: '#FFFFFF',
          'margin-bottom': '6px',
          'text-shadow': '0 1px 3px rgba(0,0,0,0.4)',
          'word-break': 'break-all',
        }}
      >
        {props.task.title}
      </div>
      <div
        style={{
          'font-size': '12px',
          color: urgencyLevel() === 'urgent' || urgencyLevel() === 'overdue'
            ? '#FCA5A5'
            : 'rgba(255, 255, 255, 0.85)',
          'font-weight': urgencyLevel() === 'urgent' || urgencyLevel() === 'overdue' ? 600 : 400,
          'text-shadow': '0 1px 2px rgba(0,0,0,0.3)',
        }}
      >
        {countdown.state().text}
      </div>

      <Show when={cardClass() === 'card-urgent'}>
        <style>{`
          @keyframes card-pulse-fc {
            0%, 100% { box-shadow: 0 0 8px rgba(239, 68, 68, 0.3); }
            50% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.6); }
          }
          .card-urgent-pulse {
            animation: card-pulse-fc 1.2s ease-in-out infinite;
          }
        `}</style>
      </Show>

      <Show when={dragging()}>
        <div style={{
          position: 'absolute', bottom: '-20px', left: '50%',
          transform: 'translateX(-50%)', 'font-size': '10px',
          color: 'rgba(255,255,255,0.7)', 'text-shadow': '0 1px 2px rgba(0,0,0,0.5)',
          'white-space': 'nowrap',
        }}>
          拖拽移动中 · 松开保存
        </div>
      </Show>

      {/* Context menu */}
      <Show when={menuOpen()}>
        <div style={{ position: 'fixed', inset: 0, 'z-index': 9998 }}
          onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu(); }} />
        <div style={{
          position: 'fixed', left: `${menuPos().x}px`, top: `${menuPos().y}px`,
          'z-index': 9999, 'min-width': '180px', 'background-color': 'white',
          border: '1px solid #E5E7EB', 'border-radius': '8px',
          'box-shadow': '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
          padding: '4px 0',
        }} onClick={(e) => e.stopPropagation()}>
          <For each={menuItems}>
            {(item) => (
              <Show when={!item.divider} fallback={<div style={{ height: '1px', 'background-color': '#E5E7EB', margin: '4px 0' }} />}>
                <div
                  style={{
                    display: 'flex', 'align-items': 'center', padding: '8px 16px',
                    'font-size': '13px', cursor: 'pointer', color: '#111827', gap: '8px',
                    'background-color': 'transparent', transition: 'background-color 0.12s ease',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#EBF5FF';
                    if (item.hasSubmenu) setSubmenuOpen(true);
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                  onClick={() => { if (!item.hasSubmenu) item.onClick?.(); }}
                >
                  <span style={{ width: '16px', 'text-align': 'center', 'flex-shrink': 0, color: '#3B82F6', 'font-size': '14px' }}>
                    {item.checked ? (typeof item.checked === 'function' ? (item.checked as () => boolean)() ? '✓' : '' : '✓') : ''}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <Show when={item.hasSubmenu}>
                    <span style={{ 'margin-left': 'auto', 'font-size': '11px', color: '#9CA3AF' }}>▸</span>
                  </Show>

                  {/* Submenu */}
                  <Show when={item.hasSubmenu && submenuOpen()}>
                    <div style={{
                      position: 'absolute', left: '100%', top: '0', 'min-width': '160px',
                      'background-color': 'white', border: '1px solid #E5E7EB', 'border-radius': '8px',
                      'box-shadow': '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '4px 0', 'margin-left': '2px',
                    }} onClick={(e) => e.stopPropagation()}>
                      <For each={sizeSubMenu}>
                        {(sub) => (
                          <div
                            style={{
                              display: 'flex', 'align-items': 'center', padding: '8px 16px',
                              'font-size': '13px', cursor: 'pointer', color: '#111827', gap: '8px',
                              'background-color': 'transparent', transition: 'background-color 0.12s ease',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EBF5FF'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                            onClick={() => sub.onClick?.()}
                          >
                            <span style={{ width: '16px', 'text-align': 'center', 'flex-shrink': 0, color: '#3B82F6', 'font-size': '14px' }}>
                              {sub.checked ? (typeof sub.checked === 'function' ? (sub.checked as () => boolean)() ? '✓' : '' : '✓') : ''}
                            </span>
                            <span>{sub.label}</span>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </Show>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

// ===== Outer component (loads data, renders inner) =====
const FloatingCard: Component<{ taskId: string }> = (props) => {
  const [task, setTask] = createSignal<Task | null>(null);
  const [config, setConfig] = createSignal<FloatingCardConfig | null>(null);
  const [loaded, setLoaded] = createSignal(false);

  onMount(async () => {
    if (!isTauriEnvironment()) return;
    try {
      const tasks = await query<Task>('SELECT * FROM tasks WHERE id = ?', [props.taskId]);
      if (tasks.length > 0) setTask(tasks[0]);

      const configs = await query<FloatingCardConfig>(
        'SELECT * FROM floating_card_configs WHERE task_id = ?',
        [props.taskId]
      );
      if (configs.length > 0) {
        setConfig(configs[0]);
      } else {
        await execute(
          'INSERT INTO floating_card_configs (task_id, pos_x, pos_y, card_width, always_on_top, click_through) VALUES (?, 20, 20, 220, 1, 0)',
          [props.taskId]
        );
      }

      // Restore click-through if needed
      if (configs.length > 0 && configs[0].click_through === 1) {
        await setClickThrough(props.taskId, true);
      }

      // Restore always_on_top
      if (configs.length > 0 && configs[0].always_on_top === 0) {
        await setFloatingAlwaysOnTop(props.taskId, false);
      }

      setLoaded(true);
    } catch (e) {
      console.error('[FloatingCard] load failed:', e);
      setLoaded(true);
    }
  });

  return (
    <Show when={loaded() && task()} fallback={<div style={{ width: '220px', height: '80px' }} />}>
      <FloatingCardContent task={task()!} config={config()} taskId={props.taskId} />
    </Show>
  );
};

export default FloatingCard;
