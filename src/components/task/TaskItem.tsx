import { Component, onCleanup, createUniqueId } from 'solid-js';
import type { ParsedTask } from '../../types/task';
import { useCountdown } from '../../hooks/useCountdown';
import { TAG_PRESET_COLORS } from '../TagInput';
import type { ContextMenuItem } from '../ContextMenu';

const TAG_PALETTE_MAP: Record<string, { bg: string; color: string }> = {
  '#EF4444': { bg: '#FEE2E2', color: '#991B1B' },
  '#3B82F6': { bg: '#DBEAFE', color: '#1E40AF' },
  '#10B981': { bg: '#D1FAE5', color: '#065F46' },
  '#F59E0B': { bg: '#FEF3C7', color: '#92400E' },
  '#8B5CF6': { bg: '#EDE9FE', color: '#5B21B6' },
  '#6B7280': { bg: '#F3F4F6', color: '#374151' },
};

function tagStyleByName(
  name: string,
  allTagsByName: Record<string, string>,
  idx: number
): { bg: string; color: string } {
  const hex = allTagsByName[name] ?? TAG_PRESET_COLORS[idx % TAG_PRESET_COLORS.length];
  return TAG_PALETTE_MAP[hex] || { bg: '#F3F4F6', color: '#111827' };
}

export interface TaskItemActionProps {
  onToggle?: (taskId: string) => void;
  onContextMenu?: (event: MouseEvent, task: ParsedTask, ctx: { close: () => void }) => void;
  allTagsByName: Record<string, string>;
}

export interface TaskItemProps extends TaskItemActionProps {
  task: ParsedTask;
}

const TaskItem: Component<TaskItemProps> = (props) => {
  const { state: countdown, deadlineText, dispose } = useCountdown(
    props.task.deadline,
    props.task.status
  );

  onCleanup(() => {
    dispose();
  });

  const isCompleted = () => props.task.status === 'completed';

  const countdownClass = () => {
    const level = countdown().level;
    if (level === 'overdue') return 'task-countdown countdown-overdue blink-overdue';
    if (level === 'urgent') return 'task-countdown countdown-urgent pulse-urgent';
    if (level === 'warning') return 'task-countdown countdown-warning';
    return 'task-countdown countdown-normal';
  };

  const uid = () => `task-item-${props.task.id}`;

  return (
    <div
      id={uid()}
      class="task-item"
      onContextMenu={(e) => {
        e.preventDefault();
        props.onContextMenu?.(e, props.task, { close: () => {} });
      }}
    >
      <div
        classList={{ 'task-checkbox': true, checked: isCompleted() }}
        onClick={() => props.onToggle && props.onToggle(props.task.id)}
      />
      <div class="task-info">
        <div classList={{ 'task-title': true, completed: isCompleted() }}>
          {props.task.title}
        </div>
        <div class="task-meta">
          {props.task.tags_list.map((t, i) => {
            const st = tagStyleByName(t, props.allTagsByName, i);
            return (
              <span
                class="tag"
                style={{
                  'background-color': st.bg,
                  color: st.color,
                }}
              >
                {t}
              </span>
            );
          })}
          <span class="task-time">{deadlineText}</span>
        </div>
      </div>
      <div class={countdownClass()}>{countdown().text}</div>
    </div>
  );
};

export default TaskItem;
