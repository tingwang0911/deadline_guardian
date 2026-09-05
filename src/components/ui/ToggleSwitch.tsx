import type { JSX } from 'solid-js';

interface ToggleSwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
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
      ...props.classList,
    }}>
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