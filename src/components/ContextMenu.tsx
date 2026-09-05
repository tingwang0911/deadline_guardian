import { Component, createEffect, For, onCleanup, Show } from 'solid-js';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  onClick?: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const ContextMenu: Component<ContextMenuProps> = (props) => {
  let menuEl: HTMLDivElement | undefined;

  createEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuEl || menuEl.contains(e.target as Node)) return;
      props.onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') props.onClose();
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    onCleanup(() => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    });
  });

  // 防越界：如果超出视口右边/下边，就贴边
  function computeStyle() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = props.x;
    let top = props.y;
    const MENU_W = 180;
    const MENU_H = 80; // 估算两项
    if (left + MENU_W > vw) left = vw - MENU_W - 8;
    if (top + MENU_H > vh) top = vh - MENU_H - 8;
    return `left:${Math.max(0, left)}px; top:${Math.max(0, top)}px; position: fixed; z-index: 2000;`;
  }

  return (
    <div
      ref={menuEl}
      style={computeStyle() as any}
      class="context-menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        style={{
          'background-color': 'white',
          border: '1px solid #E5E7EB',
          'border-radius': '8px',
          'box-shadow': '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
          'min-width': '180px',
          padding: '4px 0',
        }}
      >
        <For each={props.items}>
          {(item) => (
            <Show when={item.divider} fallback={
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.disabled) return;
                  item.onClick?.();
                  props.onClose();
                }}
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  padding: '8px 16px',
                  'font-size': '13px',
                  cursor: item.disabled ? 'default' : 'pointer',
                  color: item.danger ? '#DC2626' : (item.disabled ? '#9CA3AF' : '#111827'),
                  transition: 'background-color 0.12s ease',
                  gap: '8px',
                  'background-color': 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (item.disabled) return;
                  (e.currentTarget as HTMLElement).style.backgroundColor = item.danger ? '#FEF2F2' : '#EFF6FF';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                <Show when={item.icon}>
                  <span style={{ width: '16px', 'text-align': 'center', 'flex-shrink': 0 }}>{item.icon}</span>
                </Show>
                <span style={{ flex: 1 }}>{item.label}</span>
                <Show when={item.shortcut}>
                  <span style={{ 'margin-left': 'auto', color: '#9CA3AF', 'font-size': '11px' }}>{item.shortcut}</span>
                </Show>
              </div>
            }>
              <div style={{ height: '1px', 'background-color': '#E5E7EB', margin: '4px 0' }} />
            </Show>
          )}
        </For>
      </div>
    </div>
  );
};

export default ContextMenu;
