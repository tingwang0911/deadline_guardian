export interface Task {
  id: string;
  title: string;
  tag: string;
  deadline: Date;
  done: boolean;
  createdAt: Date;
}

export const TAG_COLORS: Record<string, string> = {
  "紧急": "tag-red",
  "工作": "tag-orange",
  "会议": "tag-blue",
  "设计": "tag-purple",
  "文档": "tag-green",
};

export const TAGS = Object.keys(TAG_COLORS);

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

const STORAGE_KEY = "deadline-guardian-tasks";

export function loadTasks(): Task[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.map((t: any) => ({
        ...t,
        deadline: new Date(t.deadline),
        createdAt: new Date(t.createdAt),
      }));
    }
  } catch (e) {
    console.error("Failed to load tasks:", e);
  }
  return [];
}

export function saveTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error("Failed to save tasks:", e);
  }
}

export function getCountdown(deadline: Date): string {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  
  if (diff < 0) return "已逾期";
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `还剩${days}天`;
  if (hours > 0) return `还剩${hours}h${minutes.toString().padStart(2, '0')}min`;
  return `还剩${minutes}min`;
}

export function getCountdownClass(deadline: Date): string {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  
  if (diff < 0) return "countdown-overdue";
  
  const hours = diff / (1000 * 60 * 60);
  
  if (hours < 1) return "countdown-urgent";
  if (hours < 3) return "countdown-warning";
  return "countdown-normal";
}
