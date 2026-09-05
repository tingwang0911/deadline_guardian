import { Component, createSignal, onMount, onCleanup, Show, createMemo } from "solid-js";
import TitleBar from "./components/chrome/TitleBar";
import TabBar from "./components/chrome/TabBar";
import AddTaskModal from "./components/AddTaskModal";
import TaskList from "./components/task/TaskList";
import Celebration from "./components/Celebration";
import ConfirmDialog from "./components/ConfirmDialog";
import { ToggleSwitch } from "./components/ui";
import { createTaskStore, TASK_MAX_COUNT } from "./stores/taskStore";
import { isTauriEnvironment } from "./services/tauriAdapter";
import type { ParsedTask } from "./types/task";

const App: Component = () => {
  const [activeTab, setActiveTab] = createSignal("tasks");
  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const [editTask, setEditTask] = createSignal<ParsedTask | null>(null);
  const [celebrationVisible, setCelebrationVisible] = createSignal(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = createSignal(false);
  const [taskToDelete, setTaskToDelete] = createSignal<ParsedTask | null>(null);

  const taskStore = createTaskStore();

  const [drinkingEnabled, setDrinkingEnabled] = createSignal(true);
  const [standingEnabled, setStandingEnabled] = createSignal(true);
  const [eyecareEnabled, setEyecareEnabled] = createSignal(false);
  const [autoStart, setAutoStart] = createSignal(true);

  const canCreate = createMemo(() => taskStore.canCreateTask());
  const taskCount = createMemo(() => taskStore.taskCount());

  function openAddModal() {
    setEditTask(null);
    setIsModalOpen(true);
  }

  function openEditModal(task: ParsedTask) {
    setEditTask(task);
    setIsModalOpen(true);
  }

  function requestDeleteTask(task: ParsedTask) {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  }

  async function confirmDeleteTask() {
    const task = taskToDelete();
    if (!task) {
      setDeleteDialogOpen(false);
      return;
    }
    try {
      await taskStore.removeTask(task.id);
      // TODO: 关闭对应悬浮卡片窗口（后续与窗口管理结合）
    } catch (e) {
      console.error('[App] 删除任务失败:', e);
      alert('删除失败: ' + (e as Error).message);
    } finally {
      setTaskToDelete(null);
      setDeleteDialogOpen(false);
    }
  }

  (window as any).openAddModal = openAddModal;

  onMount(() => {
    taskStore.loadTasks();

    let unsubscribe: (() => void) | undefined;
    let unsubCelebration: (() => void) | undefined;

    const setupListener = async () => {
      if (!isTauriEnvironment()) {
        console.log('[App] Not in Tauri environment, skipping event listener');
        return;
      }
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unsubscribe = await listen('show-add-modal', () => {
          openAddModal();
        });
        // Listen for celebration from floating card "complete task"
        unsubCelebration = await listen('task-completed-celebration', () => {
          setCelebrationVisible(true);
          taskStore.loadTasks();
        });
      } catch (e) {
        console.log('[App] Failed to setup event listener:', e);
      }
    };

    setupListener();

    // F12 打开 DevTools（通过 Rust 命令，Tauri v2 JS API 无 devtools 方法）
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        if (isTauriEnvironment()) {
          import('@tauri-apps/api/core')
            .then(({ invoke }) => invoke('open_devtools'))
            .catch((err) => console.warn('[App] openDevtools failed:', err));
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);

    onCleanup(() => {
      if (unsubscribe) unsubscribe();
      if (unsubCelebration) unsubCelebration();
      window.removeEventListener('keydown', onKeyDown);
    });
  });

  const handleAddTask = async () => {
    taskStore.setCurrentView('all');
    await taskStore.loadTasks();
  };

  const handleTaskCompleted = (taskId: string) => {
    setCelebrationVisible(true);
  };

  return (
    <div class="app-window">
      <TitleBar />
      <TabBar activeTab={activeTab()} onChange={setActiveTab} />

      {!isTauriEnvironment() && (
        <div class="env-warning">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>浏览器预览模式 - 数据库功能不可用，请在 Tauri 窗口中使用</span>
        </div>
      )}

      <div classList={{ "tab-content": true, "active": activeTab() === "tasks" }}>
        <TaskList
          store={taskStore}
          onTaskCompleted={handleTaskCompleted}
          onTaskEditRequested={openEditModal}
          onTaskDeleteRequested={requestDeleteTask}
          onOpenAddModal={openAddModal}
        />
      </div>

      <div classList={{ "tab-content": true, "active": activeTab() === "health" }}>
        <div class="health-section">
          <div class="health-section-title">功能开关</div>

          <div class="health-item">
            <div class="health-info">
              <div class="health-name">喝水提醒</div>
              <div class="health-desc">定时提醒喝水，记录每日饮水量</div>
            </div>
            <ToggleSwitch checked={drinkingEnabled()} onChange={setDrinkingEnabled} />
          </div>

          <div class="health-item">
            <div class="health-info">
              <div class="health-name">久坐/站立提醒</div>
              <div class="health-desc">久坐后提醒站立活动，附带文字拉伸指导</div>
            </div>
            <ToggleSwitch checked={standingEnabled()} onChange={setStandingEnabled} />
          </div>

          <div class="health-item">
            <div class="health-info">
              <div class="health-name">护眼/远眺提醒</div>
              <div class="health-desc">20-20-20法则，支持强制黑屏远眺</div>
            </div>
            <ToggleSwitch checked={eyecareEnabled()} onChange={setEyecareEnabled} />
          </div>

          <div class="health-general">
            <div class="health-general-title">通用设置</div>

            <div class="general-setting">
              <div class="general-label">空闲重置时长</div>
              <select class="general-select">
                <option value="3">3分钟</option>
                <option value="5" selected>5分钟（默认）</option>
                <option value="10">10分钟</option>
                <option value="15">15分钟</option>
                <option value="never">从不重置</option>
              </select>
            </div>

            <div class="general-setting">
              <div class="general-label">通知方式</div>
              <select class="general-select">
                <option value="sound-popup" selected>声音 + 弹窗</option>
                <option value="sound">仅声音</option>
                <option value="popup">仅弹窗</option>
              </select>
            </div>

            <div class="general-setting">
              <label class="checkbox">
                <input type="checkbox" checked={autoStart()} onChange={(e) => setAutoStart(e.target.checked)}/>
                <span class="checkbox-mark"></span>
                <span>开机自动启动</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', 'align-items': 'center', gap: '10px' }}>
        <Show when={!canCreate()}>
          <div
            style={{
              position: 'fixed',
              right: '96px',
              bottom: '26px',
              color: '#DC2626',
              'font-size': '12px',
              'font-weight': 500,
              'z-index': 998,
            }}
            title={`当前任务: ${taskCount()}条 / 上限 ${TASK_MAX_COUNT}条`}
          >
            已达任务上限（{TASK_MAX_COUNT}条）
          </div>
        </Show>

        <button
          class="fab"
          title={canCreate() ? "快速添加" : `已达任务上限（${TASK_MAX_COUNT}条）`}
          disabled={!canCreate()}
          style={{
            cursor: canCreate() ? 'pointer' : 'not-allowed',
            opacity: canCreate() ? 1 : 0.5,
          }}
          onClick={() => {
            if (canCreate()) openAddModal();
          }}
        >
          +
        </button>
      </div>

      <AddTaskModal
        isOpen={isModalOpen()}
        onClose={() => {
          setIsModalOpen(false);
          setEditTask(null);
        }}
        onTaskCreated={handleAddTask}
        onTaskEdited={handleAddTask}
        editTask={editTask()}
        store={taskStore}
        canCreate={canCreate()}
      />

      <Celebration
        visible={celebrationVisible()}
        onComplete={() => setCelebrationVisible(false)}
      />

      <ConfirmDialog
        open={deleteDialogOpen()}
        title="删除任务"
        message="确定删除此任务吗？"
        confirmText="确定删除"
        cancelText="取消"
        danger={true}
        onConfirm={confirmDeleteTask}
        onCancel={() => {
          setTaskToDelete(null);
          setDeleteDialogOpen(false);
        }}
      />
    </div>
  );
};

export default App;
