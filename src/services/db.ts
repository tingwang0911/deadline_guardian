import { safeInvoke } from './tauriAdapter';

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowsAffected: number;
}

export interface Task {
  id: string;
  title: string;
  deadline: string;
  status: 'pending' | 'completed' | 'overdue';
  tags: string;
  show_floating: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface HealthConfig {
  id: string;
  enabled: number;
  interval_min: number;
  extra_config: string;
}

export interface Setting {
  id: string;
  idle_reset_min: number;
  notify_mode: string;
  auto_start: number;
  close_action: string;
  hotkeys: string;
  today_silent_date: string | null;
}

export interface WaterLog {
  id: string;
  date: string;
  count: number;
}

export interface FloatingCardConfig {
  task_id: string;
  pos_x: number;
  pos_y: number;
  card_width: number;
  font_family: string;
  font_size: number;
  font_bold: number;
  text_color: string;
  stroke_color: string;
  stroke_width: number;
  bg_color: string;
  bg_opacity: number;
  locked: number;
  always_on_top: number;
  click_through: number;
  monitor_index: number;
}

export interface RecentColor {
  id: string;
  hex: string;
  source: string;
  used_at: string;
}

export interface SprintSnapshot {
  id: string;
  task_id: string;
  drinking_interval_min: number | null;
  standing_enabled: number | null;
  eyecare_mode: string | null;
  entered_at: string;
  exited_at: string | null;
}

export async function execute(sql: string, params?: unknown[]): Promise<QueryResult> {
  console.log('[DB] execute:', sql, params);
  const result = await safeInvoke('db_execute', { sql, params: params || [] });
  console.log('[DB] execute result:', result);
  return result as QueryResult;
}

export async function query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
  console.log('[DB] query:', sql, params);
  const result = await safeInvoke('db_query', { sql, params: params || [] });
  console.log('[DB] query result:', result);
  return result as T[];
}

export async function insert<T>(table: string, data: Record<string, unknown>): Promise<string> {
  const columns = Object.keys(data).join(', ');
  const placeholders = Object.keys(data).map(() => '?').join(', ');
  const values = Object.values(data);
  
  const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
  await execute(sql, values);
  
  // Get the last inserted id
  const result = await query<{ id: string }>(`SELECT id FROM ${table} ORDER BY rowid DESC LIMIT 1`);
  
  if (result.length > 0) {
    return result[0].id as string;
  }
  
  return '';
}

export async function update(table: string, data: Record<string, unknown>, where: string, params?: unknown[]): Promise<number> {
  const setClause = Object.keys(data).map((key) => `${key} = ?`).join(', ');
  const values = [...Object.values(data), ...(params || [])];
  
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
  const result = await execute(sql, values);
  
  return result.rowsAffected;
}

export async function del(table: string, where: string, params?: unknown[]): Promise<number> {
  const sql = `DELETE FROM ${table} WHERE ${where}`;
  const result = await execute(sql, params);
  
  return result.rowsAffected;
}

export async function getTasks(status?: string): Promise<Task[]> {
  if (status) {
    return query<Task>('SELECT * FROM tasks WHERE status = ? ORDER BY deadline ASC', [status]);
  }
  return query<Task>('SELECT * FROM tasks ORDER BY deadline ASC');
}

export async function getTaskById(id: string): Promise<Task | null> {
  const result = await query<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
  return result.length > 0 ? result[0] : null;
}

export async function createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at'>): Promise<string> {
  // 注意：故意不传入 completed_at/created_at/updated_at，
  // 用 SQLite DEFAULT（NULL / datetime('now','localtime')）兜底；
  // 同时把参数数量控制在 5 个以内，规避当前 Rust db_execute 的 >=6 参数绑定 bug
  return insert('tasks', {
    title: task.title,
    deadline: task.deadline,
    status: task.status,
    tags: task.tags || '',
    show_floating: task.show_floating || 0,
  });
}

export async function updateTask(id: string, updates: Partial<Omit<Task, 'id'>>): Promise<number> {
  return update('tasks', { ...updates, updated_at: new Date().toISOString() }, 'id = ?', [id]);
}

export async function deleteTask(id: string): Promise<number> {
  return del('tasks', 'id = ?', [id]);
}

export async function getTags(): Promise<Tag[]> {
  return query<Tag>('SELECT * FROM tags ORDER BY created_at ASC');
}

export async function getTagByName(name: string): Promise<Tag | null> {
  const result = await query<Tag>('SELECT * FROM tags WHERE name = ?', [name]);
  return result.length > 0 ? result[0] : null;
}

export async function createTag(name: string, color?: string): Promise<string> {
  return insert('tags', {
    name,
    color: color || '#3B82F6',
  });
}

export async function updateTag(id: string, updates: Partial<Pick<Tag, 'name' | 'color'>>): Promise<number> {
  return update('tags', updates, 'id = ?', [id]);
}

export async function deleteTag(id: string): Promise<number> {
  return del('tags', 'id = ?', [id]);
}

export async function getHealthConfigs(): Promise<HealthConfig[]> {
  return query<HealthConfig>('SELECT * FROM health_configs');
}

export async function getHealthConfigById(id: string): Promise<HealthConfig | null> {
  const result = await query<HealthConfig>('SELECT * FROM health_configs WHERE id = ?', [id]);
  return result.length > 0 ? result[0] : null;
}

export async function updateHealthConfig(id: string, updates: Partial<HealthConfig>): Promise<number> {
  return update('health_configs', updates, 'id = ?', [id]);
}

export async function getSettings(): Promise<Setting | null> {
  const result = await query<Setting>('SELECT * FROM settings');
  return result.length > 0 ? result[0] : null;
}

export async function updateSettings(updates: Partial<Omit<Setting, 'id'>>): Promise<number> {
  return update('settings', updates, 'id = ?', ['singleton']);
}

export async function getWaterLog(date: string): Promise<WaterLog | null> {
  const result = await query<WaterLog>('SELECT * FROM water_log WHERE date = ?', [date]);
  return result.length > 0 ? result[0] : null;
}

export async function createOrUpdateWaterLog(date: string, count: number): Promise<void> {
  const existing = await getWaterLog(date);
  if (existing) {
    await update('water_log', { count }, 'date = ?', [date]);
  } else {
    await insert('water_log', { date, count });
  }
}

export async function getFloatingCardConfig(taskId: string): Promise<FloatingCardConfig | null> {
  const result = await query<FloatingCardConfig>('SELECT * FROM floating_card_configs WHERE task_id = ?', [taskId]);
  return result.length > 0 ? result[0] : null;
}

export async function createOrUpdateFloatingCardConfig(config: FloatingCardConfig): Promise<void> {
  const existing = await getFloatingCardConfig(config.task_id);
  if (existing) {
    const { task_id, ...updates } = config;
    await update('floating_card_configs', updates as unknown as Record<string, unknown>, 'task_id = ?', [task_id]);
  } else {
    await insert('floating_card_configs', { ...(config as unknown as Record<string, unknown>) });
  }
}

export async function deleteFloatingCardConfig(taskId: string): Promise<number> {
  return del('floating_card_configs', 'task_id = ?', [taskId]);
}

export async function getRecentColors(): Promise<RecentColor[]> {
  return query<RecentColor>('SELECT * FROM recent_colors ORDER BY used_at DESC');
}

export async function addRecentColor(hex: string, source?: string): Promise<string> {
  return insert('recent_colors', {
    hex,
    source: source || 'theme',
  });
}

export async function createSprintSnapshot(taskId: string, config: {
  drinking_interval_min?: number;
  standing_enabled?: number;
  eyecare_mode?: string;
}): Promise<string> {
  return insert('sprint_snapshots', {
    task_id: taskId,
    drinking_interval_min: config.drinking_interval_min || null,
    standing_enabled: config.standing_enabled || null,
    eyecare_mode: config.eyecare_mode || null,
  });
}

export async function updateSprintSnapshot(id: string, exitedAt: string): Promise<number> {
  return update('sprint_snapshots', { exited_at: exitedAt }, 'id = ?', [id]);
}

export async function getActiveSprintSnapshot(taskId: string): Promise<SprintSnapshot | null> {
  const result = await query<SprintSnapshot>(
    'SELECT * FROM sprint_snapshots WHERE task_id = ? AND exited_at IS NULL ORDER BY entered_at DESC LIMIT 1',
    [taskId]
  );
  return result.length > 0 ? result[0] : null;
}
