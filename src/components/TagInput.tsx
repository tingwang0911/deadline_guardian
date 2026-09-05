import { Component, createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { getTags as dbGetTags, createTag as dbCreateTag, deleteTag as dbDeleteTag, type Tag } from '../services/db';

export const TAG_PRESET_COLORS: readonly string[] = [
  '#EF4444', // 红
  '#3B82F6', // 蓝
  '#10B981', // 绿
  '#F59E0B', // 橙
  '#8B5CF6', // 紫
  '#6B7280', // 灰
];

export const TAG_MAX_COUNT = 50;

interface TagInputProps {
  selected: string[];
  onChange: (names: string[]) => void;
}

// 把标签十六进制颜色转成浅背景色 + 深文字色
function tagStyle(hex: string): { bg: string; color: string } {
  // 按原型 app.css：#EF4444 -> bg(#FEE2E2) color(#991B1B) 这种深浅对
  const map: Record<string, { bg: string; color: string }> = {
    '#EF4444': { bg: '#FEE2E2', color: '#991B1B' },
    '#3B82F6': { bg: '#DBEAFE', color: '#1E40AF' },
    '#10B981': { bg: '#D1FAE5', color: '#065F46' },
    '#F59E0B': { bg: '#FEF3C7', color: '#92400E' },
    '#8B5CF6': { bg: '#EDE9FE', color: '#5B21B6' },
    '#6B7280': { bg: '#F3F4F6', color: '#374151' },
  };
  return map[hex] || { bg: '#F3F4F6', color: '#111827' };
}

function colorForIndex(idx: number): string {
  return TAG_PRESET_COLORS[idx % TAG_PRESET_COLORS.length];
}

const TagInput: Component<TagInputProps> = (props) => {
  const [allTags, setAllTags] = createSignal<Tag[]>([]);
  const [inputValue, setInputValue] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  let inputEl: HTMLInputElement | undefined;

  async function reloadAllTags() {
    try {
      const list = await dbGetTags();
      // 自动清理 0 关联任务的标签：先查所有任务 tags 字段聚合，剔除未被任何任务引用且不在当前选择中的 tag
      setAllTags(list);
    } catch (e) {
      console.error('[TagInput] reloadAllTags failed:', e);
    }
  }

  onMount(reloadAllTags);

  onCleanup(() => {});

  function findByName(name: string): Tag | undefined {
    return allTags().find((t) => t.name.toLowerCase() === name.toLowerCase());
  }

  async function tryCreate(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (props.selected.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      // 已选中，忽略
      setInputValue('');
      return;
    }

    if (allTags().length >= TAG_MAX_COUNT && !findByName(trimmed)) {
      alert(`标签数量已达上限（${TAG_MAX_COUNT} 个）`);
      return;
    }

    let tag = findByName(trimmed);
    if (!tag) {
      setLoading(true);
      try {
        const colorIdx = allTags().length;
        const color = colorForIndex(colorIdx);
        const id = await dbCreateTag(trimmed, color);
        // 重新获取全量列表（带创建后的 id/color）
        const list = await dbGetTags();
        setAllTags(list);
        tag = list.find((t) => t.id === id);
      } catch (e) {
        console.error('[TagInput] createTag failed:', e);
      } finally {
        setLoading(false);
      }
    }
    if (tag) {
      props.onChange([...props.selected, tag.name]);
    }
    setInputValue('');
  }

  function removeAt(idx: number) {
    const next = props.selected.slice();
    next.splice(idx, 1);
    props.onChange(next);
  }

  async function cleanupUnusedTags() {
    // 已经不在任何任务的 tags 列表中，也不在当前选择中 → 删除
    // 实际删除会在 taskStore 加载时统一处理，这里只是提示
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = inputValue();
      if (v) {
        tryCreate(v);
      }
    } else if (e.key === 'Backspace' && !inputValue() && props.selected.length > 0) {
      // 输入框为空按退格删除最后一个标签
      e.preventDefault();
      removeAt(props.selected.length - 1);
    }
  }

  return (
    <div
      class="tag-input-area"
      onClick={() => inputEl?.focus()}
      style={{
        display: 'flex',
        'flex-wrap': 'wrap',
        gap: '6px',
        padding: '6px 10px',
        border: '1px solid var(--color-border, #E5E7EB)',
        'border-radius': '6px',
        'min-height': '36px',
        'align-items': 'center',
        'background-color': 'var(--color-bg-card, white)',
        cursor: 'text',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      }}
      onFocusIn={() => {
        // focus-within 效果用 CSS 模拟：这里通过 style 直接加
      }}
    >
      <For each={props.selected}>
        {(name, idx) => {
          const tag = () => findByName(name);
          const color = () => (tag() ? tag()!.color : TAG_PRESET_COLORS[props.selected.indexOf(name) % TAG_PRESET_COLORS.length]);
          const st = tagStyle(color());
          return (
            <span
              style={{
                display: 'inline-flex',
                'align-items': 'center',
                padding: '1px 6px 1px 8px',
                'border-radius': '999px',
                'background-color': st.bg,
                color: st.color,
                'font-size': '12px',
                'font-weight': 500,
                gap: '4px',
              }}
            >
              {name}
              <button
                type="button"
                title="移除标签"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(idx());
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: st.color,
                  cursor: 'pointer',
                  padding: 0,
                  width: '14px',
                  height: '14px',
                  'line-height': '12px',
                  'border-radius': '50%',
                  opacity: 0.7,
                  display: 'inline-flex',
                  'align-items': 'center',
                  'justify-content': 'center',
                  'font-size': '14px',
                }}
              >
                ×
              </button>
            </span>
          );
        }}
      </For>

      <input
        ref={inputEl}
        type="text"
        value={inputValue()}
        onInput={(e) => setInputValue(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder={props.selected.length === 0 ? '输入标签名称，按回车添加' : '继续添加…'}
        style={{
          border: 'none',
          outline: 'none',
          'font-size': '13px',
          flex: 1,
          'min-width': '100px',
          background: 'transparent',
          color: 'var(--color-text-primary, #111827)',
          'font-family': 'inherit',
          padding: '4px 0',
        }}
      />
    </div>
  );
};

export default TagInput;
