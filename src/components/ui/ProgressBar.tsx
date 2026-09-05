import type { JSX } from 'solid-js';

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  classList?: { [key: string]: boolean };
}

export function ProgressBar(props: ProgressBarProps): JSX.Element {
  const max = props.max ?? 100;
  const percentage = Math.min(100, Math.max(0, (props.value / max) * 100));

  return (
    <div classList={{
      "progress-bar": true,
      ...props.classList,
    }}>
      <div
        class="progress-bar-fill"
        style={{
          width: `${percentage}%`,
          'background-color': props.color,
        }}
      />
    </div>
  );
}