import type { JSX } from 'solid-js';

interface RadioProps {
  name: string;
  value?: string;
  checked?: boolean;
  onChange?: (value: string) => void;
  label?: string;
  disabled?: boolean;
  classList?: { [key: string]: boolean };
}

export function Radio(props: RadioProps): JSX.Element {
  return (
    <label classList={{
      "radio": true,
      ...props.classList,
    }}>
      <input
        type="radio"
        name={props.name}
        value={props.value}
        checked={props.checked}
        onChange={(e) => props.onChange?.(e.target.value)}
        disabled={props.disabled}
      />
      <span class="radio-mark"></span>
      {props.label && <span>{props.label}</span>}
    </label>
  );
}