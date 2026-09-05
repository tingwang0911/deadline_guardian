import { Component, createSignal, createEffect, onMount, onCleanup, Show } from "solid-js";
import { Button, Input, Checkbox } from "./ui";
import TagInput from "./TagInput";
import type { TaskStore } from "../stores/taskStore";
import type { ParsedTask } from "../types/task";

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
  onTaskEdited?: () => void;
  editTask?: ParsedTask | null;
  store: TaskStore;
  canCreate: boolean;
}

const AddTaskModal: Component<AddTaskModalProps> = (props) => {
  const [title, setTitle] = createSignal("");
  const [year, setYear] = createSignal("");
  const [month, setMonth] = createSignal("");
  const [day, setDay] = createSignal("");
  const [hour, setHour] = createSignal("");
  const [minute, setMinute] = createSignal("");
  const [tags, setTags] = createSignal<string[]>([]);
  const [showFloating, setShowFloating] = createSignal(true);
  const [submitStatus, setSubmitStatus] = createSignal<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = createSignal('');

  const isEdit = () => !!props.editTask;
  const modalTitle = () => (isEdit() ? "编辑任务" : "添加新任务");
  const submitButtonText = () => (isEdit() ? "保存修改" : "创建任务");

  const years = Array.from({ length: 7 }, (_, i) => ({
    value: String(2024 + i),
    label: String(2024 + i),
  }));

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1}月`,
  }));

  const hours = Array.from({ length: 24 }, (_, i) => ({
    value: String(i),
    label: `${i.toString().padStart(2, "0")}时`,
  }));

  const minutes = Array.from({ length: 12 }, (_, i) => ({
    value: String(i * 5),
    label: `${(i * 5).toString().padStart(2, "0")}分`,
  }));

  const getDaysInMonth = () => {
    const y = parseInt(year() || "2026");
    const m = parseInt(month() || "7");
    const days = new Date(y, m, 0).getDate();
    return Array.from({ length: days }, (_, i) => ({
      value: String(i + 1),
      label: String(i + 1),
    }));
  };

  createEffect(() => {
    if (!props.isOpen) return;

    // 每次打开弹窗时重置提交状态
    setSubmitStatus('idle');
    setErrorMessage('');

    if (props.editTask) {
      // 编辑模式：预填当前数据
      const dl = new Date(props.editTask.deadline);
      setYear(String(dl.getFullYear()));
      setMonth(String(dl.getMonth() + 1));
      setDay(String(dl.getDate()));
      setHour(String(dl.getHours()));
      setMinute(String(Math.floor(dl.getMinutes() / 5) * 5));
      setTitle(props.editTask.title);
      setTags(props.editTask.tags_list.slice());
      setShowFloating(props.editTask.show_floating === 1);
    } else {
      // 新增模式：默认 1 小时后
      const now = new Date();
      now.setHours(now.getHours() + 1);
      setYear(String(now.getFullYear()));
      setMonth(String(now.getMonth() + 1));
      setDay(String(now.getDate()));
      setHour(String(now.getHours()));
      setMinute(String(Math.floor(now.getMinutes() / 5) * 5));
      setTitle("");
      setTags([]);
      setShowFloating(true);
    }

    setTimeout(() => {
      const input = document.querySelector(".add-task-title") as HTMLInputElement;
      if (input) input.focus();
    }, 50);
  });

  const isFormValid = () => {
    const len = title().trim().length;
    return len >= 2 && len <= 100;
  };

  const isSubmitDisabled = () => {
    if (!isFormValid()) return true;
    if (!isEdit() && !props.canCreate) return true;
    return false;
  };

  const handleSubmit = async () => {
    setSubmitStatus('loading');
    setErrorMessage('');
    document.title = '[创建中...] Deadline Guardian';
    console.log('[AddTaskModal] handleSubmit called, edit=', isEdit());

    // 超时保护：任何后端调用超过 15 秒未返回则报错，避免按钮永久卡在"创建中"
    const withTimeout = <T,>(p: Promise<T>, label: string): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`${label}超时（15秒无响应），请重试`)),
          15000
        );
        p.then(
          (v) => { clearTimeout(timer); resolve(v); },
          (e) => { clearTimeout(timer); reject(e); }
        );
      });

    try {
      if (!isFormValid()) {
        console.log('[AddTaskModal] Form invalid, returning');
        setSubmitStatus('error');
        setErrorMessage('标题至少需要 2 个字符');
        document.title = 'Deadline Guardian';
        return;
      }

      const deadline = new Date(
        parseInt(year()),
        parseInt(month()) - 1,
        parseInt(day()),
        parseInt(hour()),
        parseInt(minute())
      );

      console.log('[AddTaskModal] Deadline:', deadline.toISOString());
      console.log('[AddTaskModal] Title:', title().trim());
      console.log('[AddTaskModal] Tags:', tags());

      if (isEdit() && props.editTask) {
        await withTimeout(
          props.store.editTask(props.editTask.id, {
            title: title().trim(),
            deadline: deadline.toISOString(),
            tags: tags(),
            show_floating: showFloating(),
          }),
          '保存修改'
        );
        props.onTaskEdited?.();
      } else {
        if (!props.canCreate) {
          setSubmitStatus('error');
          setErrorMessage('已达任务上限（1000条），请先删除部分任务');
          document.title = 'Deadline Guardian';
          return;
        }
        console.log('[AddTaskModal] Calling createTask...');
        await withTimeout(
          props.store.createTask({
            title: title().trim(),
            deadline: deadline.toISOString(),
            tags: tags(),
            show_floating: showFloating(),
          }),
          '创建任务'
        );
        console.log('[AddTaskModal] createTask succeeded');
        props.onTaskCreated();
      }
      setSubmitStatus('idle');
      document.title = 'Deadline Guardian';
      props.onClose();
    } catch (error) {
      console.error('[AddTaskModal] Error submit task:', error);
      const msg = error instanceof Error ? error.message : String(error);
      setSubmitStatus('error');
      setErrorMessage(msg);
      document.title = 'Deadline Guardian';
    }
  };

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="modal-overlay" onClick={handleOverlayClick}>
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">{modalTitle()}</span>
            <button class="modal-close" onClick={props.onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">任务标题 <span class="required">*</span></label>
              <Input
                classList={{ "add-task-title": true }}
                placeholder="请输入任务标题（2-100字）"
                value={title()}
                onChange={setTitle}
              />
              <Show when={title().trim().length > 0 && title().trim().length < 2}>
                <span style={{ color: "#EF4444", "font-size": "12px", "margin-top": "4px", display: "block" }}>
                  标题至少需要 2 个字符
                </span>
              </Show>
            </div>

            <div class="form-group">
              <label class="form-label">提醒时间 <span class="required">*</span></label>
              <div class="datetime-row">
                <select class="flex-1" value={year()} onChange={(e) => setYear((e.target as HTMLSelectElement).value)}>
                  {years.map((y) => (
                    <option key={y.value} value={y.value}>{y.label}</option>
                  ))}
                </select>
                <span class="separator">/</span>
                <select class="flex-1" value={month()} onChange={(e) => setMonth((e.target as HTMLSelectElement).value)}>
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <span class="separator">/</span>
                <select class="flex-1" value={day()} onChange={(e) => setDay((e.target as HTMLSelectElement).value)}>
                  {getDaysInMonth().map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                <span class="separator">&nbsp;</span>
                <select class="flex-1" value={hour()} onChange={(e) => setHour((e.target as HTMLSelectElement).value)}>
                  {hours.map((h) => (
                    <option key={h.value} value={h.value}>{h.label}</option>
                  ))}
                </select>
                <span class="separator">:</span>
                <select class="flex-1" value={minute()} onChange={(e) => setMinute((e.target as HTMLSelectElement).value)}>
                  {minutes.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div class="form-hint">默认设置为当前时间 +1 小时</div>
            </div>

            <div class="form-group">
              <label class="form-label">标签（可选）</label>
              <TagInput
                selected={tags()}
                onChange={(next) => setTags(next)}
              />
              <div class="form-hint">输入标签名称后按回车键添加；输入框为空时按退格键删除最后一个标签</div>
            </div>

            <Show when={!isEdit() && !props.canCreate}>
              <div class="form-hint" style={{ color: '#DC2626', 'font-weight': 500 }}>
                已达任务上限（1000条），请先删除部分任务
              </div>
            </Show>

            <div class="form-group">
              <Checkbox
                checked={showFloating()}
                onChange={setShowFloating}
                label="在桌面显示悬浮任务卡片"
              />
            </div>
          </div>

          <div class="modal-footer">
            <Show when={submitStatus() === 'error' && errorMessage()}>
              <div style={{
                flex: 1,
                color: '#EF4444',
                'font-size': '12px',
                padding: '4px 0',
                'word-break': 'break-all',
              }}>
                {errorMessage()}
              </div>
            </Show>
            <Button variant="secondary" onClick={props.onClose}>取消</Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={isSubmitDisabled() || submitStatus() === 'loading'}
            >
              {submitStatus() === 'loading' ? '创建中...' : submitButtonText()}
            </Button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default AddTaskModal;
