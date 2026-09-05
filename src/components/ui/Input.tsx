import type { JSX } from 'solid-js';

interface InputProps {
  type?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  classList?: { [key: string]: boolean };
}

export function Input(props: InputProps): JSX.Element {
  return (
    <input
      type={props.type ?? "text"}
      value={props.value}
      onChange={(e) => props.onChange?.(e.target.value)}
      placeholder={props.placeholder}
      disabled={props.disabled}
      classList={{
        "input": true,
        ...props.classList,
      }}
    />
  );
}