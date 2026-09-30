import type { JSX } from 'solid-js';

interface ToggleSwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** 鼠标悬停提示，如“是否开启提醒” */
  title?: string;
  classList?: { [key: string]: boolean };
}

export function ToggleSwitch(props: ToggleSwitchProps): JSX.Element {
  const handleChange = () => {
    if (props.disabled) return;
    const newValue = !(props.checked ?? false);
    props.onChange?.(newValue);
  };

  return (
    <label classList={{
      "toggle-switch": true,
      "is-disabled": props.disabled ?? false,
      ...props.classList,
    }}
      title={props.title}
    >
      <input
        type="checkbox"
        checked={props.checked ?? false}
        onChange={handleChange}
        disabled={props.disabled}
      />
      <span class="toggle-slider"></span>
    </label>
  );
}