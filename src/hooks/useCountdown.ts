import { createSignal, createMemo } from 'solid-js';
import type { TaskView } from '../types/task';

export interface CountdownState {
  text: string;
  level: 'normal' | 'warning' | 'urgent' | 'overdue';
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function parseDeadlineDate(deadline: string): string {
  const d = new Date(deadline);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isSameDay(d, today)) {
    return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (isSameDay(d, tomorrow)) {
    return `明天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatCountdown(msRemaining: number): CountdownState {
  if (msRemaining < 0) {
    return { text: '已逾期', level: 'overdue' };
  }

  const totalMinutes = Math.floor(msRemaining / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  let level: CountdownState['level'] = 'normal';
  if (msRemaining < 30 * 60 * 1000) {
    level = 'urgent';
  } else if (msRemaining < 2 * 60 * 60 * 1000) {
    level = 'warning';
  }

  let text: string;
  if (days > 0) {
    text = `还剩${days}天${hours}h${pad(minutes)}min`;
  } else if (hours > 0) {
    text = `还剩${hours}h${pad(minutes)}min`;
  } else {
    text = `还剩${minutes}min`;
  }

  return { text, level };
}

export function useCountdown(deadline: string, status: string) {
  const [tick, setTick] = createSignal(0);

  let timer: number | undefined;

  const setupTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }

    if (status === 'completed') {
      return;
    }

    const now = Date.now();
    const dl = new Date(deadline).getTime();

    if (now >= dl) {
      return;
    }

    timer = window.setInterval(() => setTick((t) => t + 1), 1000);
  };

  setupTimer();

  const state = createMemo<CountdownState>(() => {
    void tick();
    if (status === 'completed') {
      return { text: '已完成', level: 'normal' };
    }
    const now = Date.now();
    const dl = new Date(deadline).getTime();
    return formatCountdown(dl - now);
  });

  const deadlineText = parseDeadlineDate(deadline);

  return {
    state,
    deadlineText,
    dispose: () => {
      if (timer) clearInterval(timer);
    },
  };
}
