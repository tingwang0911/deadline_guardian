import { Component, Show, For, createEffect, createMemo, createSignal, onMount } from 'solid-js';
import TaskItem from './TaskItem';
import ContextMenu, { ContextMenuItem } from '../ContextMenu';
import type { TaskStore } from '../../stores/taskStore';
import type { TaskView, ParsedTask } from '../../types/task';
import { getTags as dbGetTags, type Tag } from '../../services/db';

export interface TaskListActionProps {
  onTaskCompleted?: (taskId: string) => void;
  onTaskEditRequested?: (task: ParsedTask) => void;
  onTaskDeleteRequested?: (task: ParsedTask) => void;
  onOpenAddModal?: () => void;
}

export interface TaskListProps extends TaskListActionProps {
  store: TaskStore;
}

const VIEWS: { key: TaskView; label: string }[] = [
  { key: 'today', label: '今日' },
  { key: 'all', label: '全部' },
  { key: 'done', label: '已完成' },
];

const TaskList: Component<TaskListProps> = (props) => {
  const [ctxState, setCtxState] = createSignal<{ x: number; y: number; task: ParsedTask } | null>(null);
  const [allTags, setAllTags] = createSignal<Tag[]>([]);

  onMount(async () => {
    try {
      setAllTags(await dbGetTags());
    } catch (e) {
      console.warn('[TaskList] dbGetTags failed:', e);
    }
  });

  // 标签名 -> 颜色
  const allTagsByName = createMemo(() => {
    const map: Record<string, string> = {};
    for (const t of allTags()) {
      map[t.name] = t.color;
    }
    return map;
  });

  const handleToggle = async (taskId: string) => {
    const result = await props.store.markCompleted(taskId);
    if (result === 'completed') {
      props.onTaskCompleted?.(taskId);
    }
    // 刷新标签缓存（理论上不会变，但保险一点）
    try {
      setAllTags(await dbGetTags());
    } catch {}
  };

  const buildMenuItems = (task: ParsedTask): ContextMenuItem[] => [
    {
      id: 'edit',
      label: '编辑',
      icon: '✎',
      onClick: () => props.onTaskEditRequested?.(task),
    },
    {
      id: 'div-1',
      label: '',
      divider: true,
    },
    {
      id: 'delete',
      label: '删除',
      icon: '🗑',
      danger: true,
      onClick: () => props.onTaskDeleteRequested?.(task),
    },
  ];

  return (
    <>
      {/* 搜索栏 */}
      <div class="search-bar">
        <div class="search-input-wrapper">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            class="search-input"
            placeholder="搜索任务..."
            value={props.store.state.searchKeyword}
            onInput={(e) => props.store.setSearchKeyword(e.currentTarget.value)}
          />
        </div>
        <button
          class="btn btn-primary btn-circle"
          title="添加任务"
          onClick={() => props.onOpenAddModal?.()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* 视图切换子Tab */}
      <div class="sub-tab-bar">
        <For each={VIEWS}>
          {(view) => (
            <button
              classList={{ 'sub-tab-item': true, active: props.store.state.currentView === view.key }}
              onClick={() => props.store.setCurrentView(view.key)}
            >
              {view.label}
            </button>
          )}
        </For>
      </div>

      {/* 任务列表 */}
      <Show when={!props.store.state.loading && props.store.hasTasks()}>
        <div class="task-list">
          <For each={props.store.filteredTasks()}>
            {(task) => (
              <TaskItem
                task={task}
                onToggle={handleToggle}
                onContextMenu={(e, t) =>
                  setCtxState({ x: e.clientX, y: e.clientY, task: t })
                }
                allTagsByName={allTagsByName()}
              />
            )}
          </For>
        </div>
      </Show>

      {/* 加载中 */}
      <Show when={props.store.state.loading}>
        <div class="task-list-empty">
          <div class="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2v4" />
              <path d="M12 18v4" />
              <path d="M4.93 4.93l2.83 2.83" />
              <path d="M16.24 16.24l2.83 2.83" />
              <path d="M2 12h4" />
              <path d="M18 12h4" />
              <path d="M4.93 19.07l2.83-2.83" />
              <path d="M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <div class="empty-state-text">加载中...</div>
        </div>
      </Show>

      {/* 空状态 */}
      <Show when={!props.store.state.loading && !props.store.hasTasks()}>
        <div class="task-list-empty">
          <div class="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <path d="M9 16l2 2 4-4" />
            </svg>
          </div>
          <div class="empty-state-text">暂无任务</div>
          <div class="empty-state-hint">点击右下角 + 按钮添加新任务</div>
        </div>
      </Show>

      <Show when={ctxState()}>
        <ContextMenu
          x={ctxState()!.x}
          y={ctxState()!.y}
          items={buildMenuItems(ctxState()!.task)}
          onClose={() => setCtxState(null)}
        />
      </Show>
    </>
  );
};

export default TaskList;
