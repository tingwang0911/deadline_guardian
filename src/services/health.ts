/**
 * 喝水提醒业务服务：
 * - health_configs(id='drinking')：enabled / interval_min / extra_config{cup_ml,daily_goal,gender}
 * - water_log：每喝一杯一条记录（cup_time 时刻、date 本地日期、task_id 可空）
 * - settings.today_silent_date：今日不再提醒（记录日期，跨天自然失效）
 */
import { execute, query, getWaterCupCount, addWaterCup } from './db';
import { safeInvoke } from './tauriAdapter';

export type Gender = 'male' | 'female';

export interface DrinkingConfig {
  enabled: boolean;
  intervalMin: number;  // 提醒间隔（分钟）
  cupMl: number;        // 杯型容量（ml）
  dailyGoal: number;    // 每日目标杯数（1-20）
  gender: Gender;
}

export const INTERVAL_OPTIONS = [30, 45, 60, 90, 120];
export const CUP_ML_OPTIONS = [150, 200, 250, 300, 350];

/** 本地日期串 YYYY-MM-DD（每天 00:00 自然重置） */
export function todayStr(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 本地时间串 YYYY-MM-DD HH:mm:ss */
export function nowLocalStr(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${todayStr(d)} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 从数据库加载配置（缺失字段给默认值） */
async function loadDrinkingConfigFromDb(): Promise<DrinkingConfig> {
  const rows = await query<{ enabled: number; interval_min: number; extra_config: string | null }>(
    "SELECT enabled, interval_min, extra_config FROM health_configs WHERE id = 'drinking'"
  );
  const r = rows[0];
  let extra: { cup_ml?: number; daily_goal?: number; gender?: string } = {};
  try {
    extra = r?.extra_config ? JSON.parse(r.extra_config) : {};
  } catch {
    extra = {};
  }
  return {
    enabled: (r?.enabled ?? 0) === 1,
    intervalMin: r?.interval_min ?? 45,
    cupMl: extra.cup_ml ?? 200,
    dailyGoal: extra.daily_goal ?? 8,
    gender: extra.gender === 'female' ? 'female' : 'male',
  };
}

// 配置缓存 + 串行写队列：设置项可能在极短时间内连续变更（如先改间隔再选性别），
// 读-改-写必须串行化且基于最新缓存合并，否则后一次写入会覆盖前一次的变更
let configCache: DrinkingConfig | null = null;
let saveQueue: Promise<void> = Promise.resolve();

/** 读取喝水提醒配置（缺失字段给默认值） */
export async function getDrinkingConfig(): Promise<DrinkingConfig> {
  if (!configCache) {
    configCache = await loadDrinkingConfigFromDb();
  }
  return { ...configCache };
}

/** 强制从数据库重新加载喝水配置并刷新缓存（调度 tick 使用，避免长期运行时缓存陈旧） */
export async function refreshDrinkingConfig(): Promise<DrinkingConfig> {
  configCache = await loadDrinkingConfigFromDb();
  return { ...configCache };
}

/** 保存喝水提醒配置（即时保存；任意字段变更调用一次即可，串行合并不丢更新） */
export function saveDrinkingConfig(patch: Partial<DrinkingConfig>): Promise<DrinkingConfig> {
  const task = saveQueue.then(async (): Promise<DrinkingConfig> => {
    const base = configCache ?? (await loadDrinkingConfigFromDb());
    const merged = { ...base, ...patch };
    const extra = JSON.stringify({
      cup_ml: merged.cupMl,
      daily_goal: merged.dailyGoal,
      gender: merged.gender,
    });
    await execute(
      "UPDATE health_configs SET enabled = ?, interval_min = ?, extra_config = ? WHERE id = 'drinking'",
      [merged.enabled ? 1 : 0, merged.intervalMin, extra]
    );
    configCache = merged;
    return { ...merged };
  });
  // 队列即使某次失败也继续下去（下次保存基于 DB 重新加载）
  saveQueue = task.then(() => undefined, () => undefined);
  return task;
}

/** 今日已喝杯数 */
export function getTodayCups(): Promise<number> {
  return getWaterCupCount(todayStr());
}

/** 记录"已喝一杯" */
export async function drinkOneCup(): Promise<void> {
  await addWaterCup(nowLocalStr(), todayStr(), null);
}

/** 今日是否已静默（"今日不再提醒"）；跨天自然失效 */
export async function isSilentToday(): Promise<boolean> {
  const rows = await query<{ today_silent_date: string | null }>(
    "SELECT today_silent_date FROM settings WHERE id = 'singleton'"
  );
  return rows[0]?.today_silent_date === todayStr();
}

/** 设置今日不再提醒 */
export async function setSilentToday(): Promise<void> {
  await execute("UPDATE settings SET today_silent_date = ? WHERE id = 'singleton'", [todayStr()]);
}

/** 清除静默标记（一般无需手动调用，跨天自动失效） */
export async function clearSilent(): Promise<void> {
  await execute("UPDATE settings SET today_silent_date = NULL WHERE id = 'singleton'");
}

/** 弹出喝水提醒窗口（右下角置顶；已存在则前置） */
export async function openDrinkingPopup(): Promise<void> {
  await safeInvoke('create_drinking_popup', {});
}

/** 弹出久坐/站立提醒窗口（右下角置顶；已存在则前置） */
export async function openStandingPopup(): Promise<void> {
  await safeInvoke('create_standing_popup', {});
}

/** 关闭当前弹窗窗口（仅在弹窗窗口内调用） */
export async function closeCurrentPopup(): Promise<void> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().close();
}

/**
 * 下次提醒时间（epoch ms），存 localStorage（各窗口同源共享）。
 * 0 表示尚未初始化。按提醒类型分别记录。
 */
export type ReminderType = 'drinking' | 'standing' | 'eyecare';
function nextKey(type: ReminderType): string {
  return `${type}_next_remind_at`;
}
export function getNextRemindAt(type: ReminderType): number {
  return Number(localStorage.getItem(nextKey(type)) ?? 0) || 0;
}
export function setNextRemindAt(type: ReminderType, ts: number): void {
  localStorage.setItem(nextKey(type), String(ts));
}
export function scheduleNextRemind(type: ReminderType, minutes: number): void {
  setNextRemindAt(type, Date.now() + minutes * 60_000);
}

// ============ 久坐/站立提醒 ============

export interface StandingConfig {
  enabled: boolean;
  intervalMin: number; // 提醒间隔（分钟，可手动输入）
}

/** 4 组拉伸指导（文案严格取自原型 health-standing.html，勿自行改写） */
export interface StretchGuide {
  key: string;
  name: string;
  desc: string;
}
export const STRETCH_GUIDES: StretchGuide[] = [
  { key: 'neck', name: '颈部拉伸', desc: '坐直，头缓慢向右侧倾斜，右手轻压头部右侧保持10秒后换侧' },
  { key: 'shoulder', name: '肩部环绕', desc: '双肩向前小圈环绕10次，再向后环绕10次' },
  { key: 'waist', name: '腰部扭转', desc: '坐直双手扶椅背，身体向右后方扭转保持10秒换侧' },
  { key: 'wrist', name: '手腕伸展', desc: '右臂前伸掌心向外，左手轻拉右手手指向身体保持10秒换手' },
];

const LAST_STRETCH_KEY = 'standing_last_stretch_idx';

/** 随机选一组拉伸指导，避免与上一次相同 */
export function pickRandomStretch(): StretchGuide {
  const last = Number(localStorage.getItem(LAST_STRETCH_KEY) ?? -1);
  let idx: number;
  do {
    idx = Math.floor(Math.random() * STRETCH_GUIDES.length);
  } while (STRETCH_GUIDES.length > 1 && idx === last);
  localStorage.setItem(LAST_STRETCH_KEY, String(idx));
  return STRETCH_GUIDES[idx];
}

/** 读取久坐提醒配置 */
export async function getStandingConfig(): Promise<StandingConfig> {
  const rows = await query<{ enabled: number; interval_min: number }>(
    "SELECT enabled, interval_min FROM health_configs WHERE id = 'standing'"
  );
  const r = rows[0];
  return {
    enabled: (r?.enabled ?? 0) === 1,
    intervalMin: r?.interval_min ?? 60,
  };
}

/** 保存久坐提醒配置（即时保存；extra_config 保持原样） */
export async function saveStandingConfig(patch: Partial<StandingConfig>): Promise<StandingConfig> {
  const cur = await getStandingConfig();
  const merged = { ...cur, ...patch };
  await execute(
    "UPDATE health_configs SET enabled = ?, interval_min = ? WHERE id = 'standing'",
    [merged.enabled ? 1 : 0, merged.intervalMin]
  );
  return merged;
}

// ============ 护眼/远眺提醒（首页行内直接设置间隔+模式） ============

export type EyecareMode = 'gentle' | 'force';

export interface EyecareConfig {
  enabled: boolean;
  intervalMin: number;    // 远眺提醒间隔（分钟）
  mode: EyecareMode;      // gentle=系统通知温和提醒；force=全屏强制黑屏
  lookDurationSec: number; // 强制黑屏远眺时长（秒）
  customText: string;     // 黑屏居中提示词
}

export const DEFAULT_EYECARE_TEXT = '眨眨眼，进行远眺';

/** 读取护眼提醒配置（extra_config: {mode, look_duration, custom_text}，缺失给默认值） */
export async function getEyecareConfig(): Promise<EyecareConfig> {
  const rows = await query<{
    enabled: number;
    interval_min: number;
    extra_config: string | null;
  }>("SELECT enabled, interval_min, extra_config FROM health_configs WHERE id = 'eyecare'");
  const r = rows[0];
  let extra: { mode?: string; look_duration?: number; custom_text?: string } = {};
  try {
    extra = r?.extra_config ? JSON.parse(r.extra_config) : {};
  } catch {
    extra = {};
  }
  return {
    enabled: (r?.enabled ?? 0) === 1,
    intervalMin: r?.interval_min ?? 20,
    mode: extra.mode === 'force' ? 'force' : 'gentle',
    lookDurationSec: extra.look_duration ?? 20,
    customText: extra.custom_text || DEFAULT_EYECARE_TEXT,
  };
}

/** 保存护眼提醒配置（开关/间隔/模式/时长/提示词，extra_config 整体重写） */
export async function saveEyecareConfig(patch: Partial<EyecareConfig>): Promise<EyecareConfig> {
  const cur = await getEyecareConfig();
  const merged = { ...cur, ...patch };
  const extra = JSON.stringify({
    mode: merged.mode,
    look_duration: merged.lookDurationSec,
    custom_text: merged.customText,
  });
  await execute(
    "UPDATE health_configs SET enabled = ?, interval_min = ?, extra_config = ? WHERE id = 'eyecare'",
    [merged.enabled ? 1 : 0, merged.intervalMin, extra]
  );
  return merged;
}

/**
 * 触发护眼提醒：
 * - gentle：Rust 端发 Windows 系统通知，不遮挡屏幕；
 * - force：Rust 端先做全屏检测，全屏应用时自动降级通知，否则弹出全屏黑屏。
 */
export async function triggerEyecare(
  mode: EyecareMode,
  durationSec: number,
  text: string
): Promise<void> {
  await safeInvoke('trigger_eyecare', { mode, durationSec, text });
}
