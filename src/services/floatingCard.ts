import { safeInvoke } from './tauriAdapter';

export async function createFloatingCard(
  taskId: string,
  posX?: number,
  posY?: number,
  cardWidth?: number
): Promise<void> {
  await safeInvoke('create_floating_card', {
    taskId,
    posX: posX ?? null,
    posY: posY ?? null,
    cardWidth: cardWidth ?? null,
  });
}

export async function hideFloatingCard(taskId: string): Promise<void> {
  await safeInvoke('hide_floating_card', { taskId });
}

export async function closeFloatingCard(taskId: string): Promise<void> {
  await safeInvoke('close_floating_card', { taskId });
}

export async function setFloatingPosition(
  taskId: string,
  x: number,
  y: number
): Promise<void> {
  await safeInvoke('set_floating_position', { taskId, x, y });
}

export async function setClickThrough(
  taskId: string,
  enabled: boolean
): Promise<void> {
  await safeInvoke('set_click_through', { taskId, enabled });
}

export async function setFloatingAlwaysOnTop(
  taskId: string,
  enabled: boolean
): Promise<void> {
  await safeInvoke('set_floating_always_on_top', { taskId, enabled });
}

export async function getFloatingCardCount(): Promise<number> {
  return await safeInvoke('get_floating_card_count', {});
}

export async function getFloatingCardLabels(): Promise<string[]> {
  return await safeInvoke('get_floating_card_labels', {});
}
