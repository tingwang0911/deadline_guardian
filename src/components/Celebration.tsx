import { Component, createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js';

interface CelebrationProps {
  visible: boolean;
  onComplete?: () => void;
}

const CONFETTI_COLORS = [
  '#EF4444', // 红
  '#F59E0B', // 橙
  '#10B981', // 绿
  '#3B82F6', // 蓝
  '#8B5CF6', // 紫
  '#EC4899', // 粉
  '#EAB308', // 黄
  '#06B6D4', // 青
];

interface Particle {
  id: number;
  tx: number;
  ty: number;
  size: number;
  color: string;
  radius: number; // 0:圆, 1:方
  rotate: number;
  duration: number;
}

function makeParticles(count: number): Particle[] {
  const result: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.6;
    const distance = 40 + Math.random() * 70;
    result.push({
      id: i,
      tx: Math.cos(angle) * distance,
      ty: Math.sin(angle) * distance,
      size: 3 + Math.floor(Math.random() * 5),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      radius: Math.random() > 0.5 ? 999 : 1,
      rotate: Math.floor(Math.random() * 360),
      duration: 1400 + Math.floor(Math.random() * 800),
    });
  }
  return result;
}

const Celebration: Component<CelebrationProps> = (props) => {
  const [show, setShow] = createSignal(false);
  const [fading, setFading] = createSignal(false);
  const [particles, setParticles] = createSignal<Particle[]>([]);
  let hideTimer: number | null = null;
  let fadeTimer: number | null = null;

  function clearTimers() {
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (fadeTimer) {
      window.clearTimeout(fadeTimer);
      fadeTimer = null;
    }
  }

  onMount(() => {
    if (props.visible) kickoff();
  });

  function kickoff() {
    clearTimers();
    setParticles(makeParticles(24));
    setFading(false);
    setShow(true);
    // 2s 开始淡出，2.5s 完全消失
    fadeTimer = window.setTimeout(() => setFading(true), 2000);
    hideTimer = window.setTimeout(() => {
      setShow(false);
      props.onComplete?.();
    }, 2600);
  }

  createEffect(() => {
    if (props.visible) kickoff();
  });

  onCleanup(clearTimers);

  return (
    <Show when={show()}>
      <div
        class="celebration-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          'pointer-events': 'none',
          'z-index': 9999,
          opacity: fading() ? 0 : 1,
          transition: 'opacity 0.6s ease-out',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '160px',
            height: '160px',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
          }}
        >
          {/* 彩屑粒子 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
            }}
          >
            <For each={particles()}>
              {(p) => (
                <div
                  style={{
                    position: 'absolute',
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    'background-color': p.color,
                    'border-radius': `${p.radius}px`,
                    transform: `translate(0,0) rotate(0deg) scale(1)`,
                    animation: `confetti-burst-celebrate ${p.duration}ms cubic-bezier(0.25,0.46,0.45,0.94) 150ms forwards`,
                    ['--tx-celebrate' as any]: `${p.tx}px`,
                    ['--ty-celebrate' as any]: `${p.ty}px`,
                    ['--rot-celebrate' as any]: `${p.rotate}deg`,
                  } as any}
                />
              )}
            </For>
          </div>

          {/* 绿色对勾圆形 */}
          <div
            style={{
              width: '96px',
              height: '96px',
              'border-radius': '50%',
              'background-color': '#10B981',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              'box-shadow': '0 8px 24px rgba(16, 185, 129, 0.35)',
              transform: 'scale(0)',
              animation: 'pop-check-celebrate 500ms cubic-bezier(0.34,1.56,0.64,1) 100ms forwards',
            }}
          >
            {/* 白色对勾 */}
            <div
              style={{
                width: '26px',
                height: '44px',
                border: '6px solid white',
                'border-top': 'none',
                'border-left': 'none',
                transform: 'rotate(45deg) translate(-6px, -10px)',
              }}
            />
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes pop-check-celebrate {
            0% { transform: scale(0); }
            70% { transform: scale(1.12); }
            100% { transform: scale(1); }
          }
          @keyframes confetti-burst-celebrate {
            0% {
              transform: translate(0,0) rotate(0deg) scale(1);
              opacity: 1;
            }
            50% {
              opacity: 1;
            }
            100% {
              transform: translate(var(--tx-celebrate, 40px), var(--ty-celebrate, -40px)) rotate(var(--rot-celebrate, 180deg)) scale(0.25);
              opacity: 0;
            }
          }
        `}
      </style>
    </Show>
  );
};

export default Celebration;
