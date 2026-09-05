import { Component, createSignal, createEffect } from "solid-js";
import { Task, generateId, TAGS, TAG_COLORS } from "../utils/task";

interface TaskModalProps {
  isOpen: () => boolean;
  onClose: () => void;
  onAdd: (task: Task) => void;
}

const TaskModal: Component<TaskModalProps> = (props) => {
  const [title, setTitle] = createSignal("");
  const [tag, setTag] = createSignal("工作");
  const [date, setDate] = createSignal("");
  const [time, setTime] = createSignal("");

  createEffect(() => {
    if (props.isOpen()) {
      const now = new Date();
      setDate(now.toISOString().split("T")[0]);
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      setTime(`${hours}:${minutes}`);
      setTitle("");
      setTag("工作");
      setTimeout(() => {
        const input = document.querySelector(".form-input") as HTMLInputElement;
        if (input) input.focus();
      }, 50);
    }
  });

  const handleSubmit = () => {
    if (!title().trim()) return;
    if (!date() || !time()) return;

    const deadline = new Date(`${date()}T${time()}`);
    const task: Task = {
      id: generateId(),
      title: title().trim(),
      tag: tag(),
      deadline,
      done: false,
      createdAt: new Date(),
    };

    props.onAdd(task);
    resetForm();
    props.onClose();
  };

  const resetForm = () => {
    setTitle("");
    setTag("工作");
  };

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  return props.isOpen() ? (
    <div class="modal-overlay" onClick={handleOverlayClick}>
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">添加任务</h2>
          <button class="modal-close" onClick={props.onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">任务名称</label>
            <input
              type="text"
              class="form-input"
              placeholder="输入任务名称..."
              value={title()}
              onChange={(e) => setTitle(e.target.value)}
              autofocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
          </div>

          <div class="form-group">
            <label class="form-label">标签</label>
            <div class="tag-selector">
              {TAGS.map((t) => (
                <button
                  classList={{
                    "tag-option": true,
                    "active": tag() === t,
                    [TAG_COLORS[t]]: true,
                  }}
                  onClick={() => setTag(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">日期</label>
              <input
                type="date"
                class="form-input"
                value={date()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div class="form-group">
              <label class="form-label">时间</label>
              <input
                type="time"
                class="form-input"
                value={time()}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" onClick={props.onClose}>取消</button>
          <button class="btn btn-primary" onClick={handleSubmit}>添加</button>
        </div>
      </div>
    </div>
  ) : null;
};

export default TaskModal;
