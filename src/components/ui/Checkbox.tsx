import type { JSX } from 'solid-js';

interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  classList?: { [key: string]: boolean };
}

export function Checkbox(props: CheckboxProps): JSX.Element {
  return (
    <label classList={{
      "checkbox": true,
      ...props.classList,
    }}>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange?.(e.target.checked)}
        disabled={props.disabled}
      />
      <span class="checkbox-mark"></span>
      {props.label && <span>{props.label}</span>}
    </label>
  );
}