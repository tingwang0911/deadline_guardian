import type { JSX } from 'solid-js';

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options: Option[];
  disabled?: boolean;
  classList?: { [key: string]: boolean };
}

export function Select(props: SelectProps): JSX.Element {
  return (
    <select
      value={props.value}
      onChange={(e) => props.onChange?.(e.target.value)}
      disabled={props.disabled}
      classList={{
        "select": true,
        ...props.classList,
      }}
    >
      {props.options.map((option) => (
        <option value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}