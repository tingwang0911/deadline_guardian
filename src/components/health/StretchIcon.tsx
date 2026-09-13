import type { JSX } from 'solid-js';

/** 拉伸动作的简约线性图标（装饰性，文案为主体） */
export function StretchIcon(props: { name: string }): JSX.Element {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: '#3B82F6',
    'stroke-width': 1.8,
    'stroke-linecap': 'round' as const,
    'stroke-linejoin': 'round' as const,
  };
  switch (props.name) {
    case 'neck': // 颈部：头部 + 颈脊 + 倾斜箭头
      return (
        <svg {...common}>
          <circle cx="12" cy="6.5" r="3.2" />
          <path d="M12 9.7v4.3" />
          <path d="M5 19c.7-3 3.6-4.8 7-4.8s6.3 1.8 7 4.8" />
          <path d="M16.8 4.6l1.9 1.9-1.9 1.9" />
        </svg>
      );
    case 'shoulder': // 肩部：肩线 + 环绕箭头
      return (
        <svg {...common}>
          <path d="M4 15.5c2.2-2.2 5-3.2 8-3.2s5.8 1 8 3.2" />
          <path d="M8 9.2a4.6 4.6 0 0 1 8 0" />
          <path d="M16 9.2l1.6-1.7-.2-2.3" />
          <path d="M16 12.6a4.6 4.6 0 0 1-8 0" />
          <path d="M8 12.6l-1.6 1.7.2 2.3" />
        </svg>
      );
    case 'waist': // 腰部：躯干 + 扭转环箭
      return (
        <svg {...common}>
          <path d="M12 3.5v17" />
          <path d="M9 8.5h6" />
          <path d="M9 15.5h6" />
          <path d="M15.5 10.2a3.8 3.8 0 0 0-5.2 4.6" />
          <path d="M10 15l-1.4-.4-.6-1.4" />
          <path d="M8.5 13.8a3.8 3.8 0 0 0 5.2-4.6" />
          <path d="M14 9l1.4.4.6 1.4" />
        </svg>
      );
    case 'wrist': // 手腕：手掌 + 前臂 + 拉伸箭头
      return (
        <svg {...common}>
          <path d="M3.5 17.5h6" />
          <rect x="12" y="7" width="7.5" height="9.5" rx="2.2" />
          <path d="M14 7V4.6M16.2 7V4M18.4 7V4.6" />
          <path d="M7.8 14.2l-3 3.3 3 3.3" />
        </svg>
      );
    default:
      return null;
  }
}
