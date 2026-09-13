import type { JSX } from 'solid-js';
import { createSignal, createEffect } from 'solid-js';

interface IntervalInputProps {
  value: number;
  onChange?: (minutes: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

/**
 * 提醒间隔输入：可手动输入数字，单位"分钟"。
 * 失焦/回车时提交（自动夹取到 [min, max]）；输入过程中允许临时为空。
 */
export function IntervalInput(props: IntervalInputProps): JSX.Element {
  const min = props.min ?? 1;
  const max = props.max ?? 240;
  const [text, setText] = createSignal(String(props.value));
  let inputEl: HTMLInputElement | undefined;

  // 外部值变化（如配置异步加载完成）且输入框未聚焦时同步显示
  createEffect(() => {
    const v = String(props.value);
    if (document.activeElement !== inputEl) {
      setText(v);
    }
  });

  function commit() {
    const n = parseInt(text(), 10);
    const clamped = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : props.value;
    setText(String(clamped));
    if (clamped !== props.value) {
      props.onChange?.(clamped);
    }
  }

  return (
    <div class="interval-input">
      <input
        ref={inputEl}
        type="number"
        class="interval-input-field"
        min={min}
        max={max}
        step={1}
        value={text()}
        disabled={props.disabled}
        onInput={(e) => setText(e.target.value)}
        onChange={commit}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <span class="interval-input-unit">分钟</span>
    </div>
  );
}
