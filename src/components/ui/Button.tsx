import type { JSX } from 'solid-js';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'text';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  classList?: { [key: string]: boolean };
  children?: JSX.Element;
}

export function Button(props: ButtonProps): JSX.Element {
  const variant = props.variant ?? 'primary';
  const size = props.size ?? 'md';

  return (
    <button
      classList={{
        "btn": true,
        "btn-primary": variant === "primary",
        "btn-secondary": variant === "secondary",
        "btn-danger": variant === "danger",
        "btn-text": variant === "text",
        "btn-sm": size === "sm",
        "btn-lg": size === "lg",
        ...props.classList,
      }}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}