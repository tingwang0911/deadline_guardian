import { createStore } from 'solid-js/store';
import type { TaskView, TaskStatus, ParsedTask, TaskStoreState } from '../types/task';
import {
  getTasks,
  createTask as dbCreateTask,
  updateTask as dbUpdateTask,
  deleteTask as dbDeleteTask,
  deleteFloatingCardConfig,
  type Task,
} from '../services/db';
import { closeFloatingCard } from '../services/floatingCard';
import { isTauriEnvironment } from '../services/tauriAdapter';

export const TASK_MAX_COUNT = 1000;
export const MAX_FLOATING_CARDS = 10;

function parseTags(tagsStr: string): string[] {
  if (!tagsStr) return [];
  try {
    const parsed = JSON.parse(tagsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toParsedTask(task: Task): ParsedTask {
  return {
    ...task,
    tags_list: parseTags(task.tags),
  };
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function isOverdue(dateStr: string): boolean {
  return new Date(dateStr).getTime() < Date.now();
}

export function createTaskStore() {
  const [state, setState] = createStore<TaskStoreState>({
    tasks: [],
    loading: false,
    searchKeyword: '',
    currentView: 'today',
  });

  async function loadTasks() {
    setState('loading', true);
    try {
      const tasks = await getTasks();
      setState('tasks', tasks.map(toParsedTask));
    } catch (err) {
      console.error('[taskStore] loadTasks failed:', err);
    } finally {
      setState('loading', false);
    }
  }

  function taskCount(): number {
    return state.tasks.length;
  }

  function canCreateTask(): boolean {
    return taskCount() < TASK_MAX_COUNT;
  }

  async function createTask(data: {
    title: string;
    deadline: string;
    tags?: string[];
    show_floating?: boolean;
  }) {
    if (!canCreateTask()) {
      throw new Error(`已达任务上限（${TASK_MAX_COUNT}条）`);
    }
    const tagsJson = JSON.stringify(data.tags || []);
    let id: string;
    try {
      id = await dbCreateTask({
        title: data.title,
        deadline: data.deadline,
        status: 'pending',
        tags: tagsJson,
        show_floating: data.show_floating ? 1 : 0,
      });
    } catch (dbErr) {
      console.error('[taskStore] dbCreateTask failed:', dbErr);
      throw dbErr;
    }
    // 注意：悬浮卡片窗口（floating card）功能尚未实现，
    // 此处仅把 show_floating 标志存入数据库，暂不创建窗口。
    // 待 Day 19 全屏/悬浮窗口功能完成后再恢复 createFloatingCard 调用。
    await loadTasks();
    return id;
  }

  async function editTask(
    id: string,
    data: {
      title?: string;
      deadline?: string;
      tags?: string[];
      show_floating?: boolean;
    }
  ) {
    const patch: Partial<Omit<Task, 'id'>> = {
      updated_at: new Date().toISOString(),
    };
    if (data.title !== undefined) patch.title = data.title;
    if (data.deadline !== undefined) patch.deadline = data.deadline;
    if (data.tags !== undefined) patch.tags = JSON.stringify(data.tags);
    if (data.show_floating !== undefined) patch.show_floating = data.show_floating ? 1 : 0;
    await dbUpdateTask(id, patch);
    await loadTasks();
  }

  /**
   * @returns 'completed' 如果新状态是 completed 触发庆祝动画，否则 undefined
   */
  async function markCompleted(id: string): Promise<'completed' | void> {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;

    const nowStr = new Date().toISOString();
    const wasCompleted = task.status === 'completed';
    let newStatus: TaskStatus;
    let completedAt: string | null;

    if (wasCompleted) {
      // 取消完成：deadline 已过期 → overdue；否则 pending
      newStatus = isOverdue(task.deadline) ? 'overdue' : 'pending';
      completedAt = null;
    } else {
      newStatus = 'completed';
      completedAt = nowStr;
    }

    await dbUpdateTask(id, {
      status: newStatus,
      completed_at: completedAt,
      updated_at: nowStr,
    });
    await loadTasks();

    if (!wasCompleted) return 'completed';
  }

  async function removeTask(id: string) {
    // Close floating card window if exists
    if (isTauriEnvironment()) {
      try {
        await closeFloatingCard(id);
      } catch (e) {
        console.warn('[taskStore] close floating card failed:', e);
      }
    }
    // Delete floating_card_config
    try {
      await deleteFloatingCardConfig(id);
    } catch (e) {
      console.warn('[taskStore] remove floating card config failed:', e);
    }
    await dbDeleteTask(id);
    await loadTasks();
  }

  function setSearchKeyword(keyword: string) {
    setState('searchKeyword', keyword);
  }

  function setCurrentView(view: TaskView) {
    setState('currentView', view);
  }

  function getTaskById(id: string): ParsedTask | undefined {
    return state.tasks.find((t) => t.id === id);
  }

  function filteredTasks(): ParsedTask[] {
    const kw = state.searchKeyword.trim().toLowerCase();
    let list = state.tasks;

    switch (state.currentView) {
      case 'today':
        list = list.filter(
          (t) => (t.status === 'pending' || t.status === 'overdue') && isToday(t.deadline)
        );
        break;
      case 'done':
        list = list.filter((t) => t.status === 'completed');
        break;
      case 'all':
      default:
        break;
    }

    if (kw) {
      list = list.filter((t) => t.title.toLowerCase().includes(kw));
    }

    list.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

    return list;
  }

  function hasTasks(): boolean {
    return filteredTasks().length > 0;
  }

  return {
    state,
    loadTasks,
    taskCount,
    canCreateTask,
    createTask,
    editTask,
    markCompleted,
    removeTask,
    setSearchKeyword,
    setCurrentView,
    getTaskById,
    filteredTasks,
    hasTasks,
  };
}

export type TaskStore = ReturnType<typeof createTaskStore>;
