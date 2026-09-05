export const CONSTRAINTS = {
  MAX_TASKS: 1000,
  MAX_FLOATING_CARDS: 10,
  MAX_TAGS: 50,
  MAX_TAGS_PER_TASK: 5,
  MAX_TITLE_LENGTH: 100,
  MIN_TITLE_LENGTH: 2,
  MAX_RECENT_COLORS: 30,
  VIRTUAL_SCROLL_THRESHOLD: 100,
  MIN_CARD_WIDTH: 180,
  MAX_CARD_WIDTH: 280,
} as const;

export const POLLING_INTERVALS = {
  taskReminder: 60000,
  deadlineCheck: 300000,
  healthStatus: 180000,
  systemInfo: 600000,
};

export const QUEUE_CONSTRAINTS = {
  maxLength: 100,
  batchSize: 10,
  retryAttempts: 3,
  retryDelay: 1000,
};

export const WINDOW_CONSTRAINTS = {
  maxOpen: 5,
  defaultWidth: 480,
  defaultHeight: 640,
  minWidth: 360,
  minHeight: 480,
};

export const STORAGE_CONSTRAINTS = {
  maxDataSize: 10 * 1024 * 1024,
  autoSaveInterval: 5000,
  maxHistoryLength: 1000,
};

export const NETWORK_CONSTRAINTS = {
  timeout: 10000,
  maxConcurrentRequests: 5,
  retryDelay: 2000,
  maxRetries: 3,
};

export const PERFORMANCE_CONSTRAINTS = {
  debounceDelay: 300,
  throttleDelay: 100,
  animationFrameThreshold: 16,
  memoryWarningThreshold: 500 * 1024 * 1024,
};

export default {
  ...CONSTRAINTS,
  ...POLLING_INTERVALS,
  ...QUEUE_CONSTRAINTS,
  ...WINDOW_CONSTRAINTS,
  ...STORAGE_CONSTRAINTS,
  ...NETWORK_CONSTRAINTS,
  ...PERFORMANCE_CONSTRAINTS,
};
