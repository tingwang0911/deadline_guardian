export interface ErrorInfo {
  message: string;
  code?: string;
  stack?: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

export class AppError extends Error {
  code: string;
  context?: Record<string, unknown>;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
  }
}

export const logError = (error: Error | AppError | string, context?: Record<string, unknown>): ErrorInfo => {
  const errorInfo: ErrorInfo = {
    message: typeof error === 'string' ? error : error.message,
    code: error instanceof AppError ? error.code : 'UNKNOWN_ERROR',
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: Date.now(),
    context,
  };

  console.error('[Deadline Guardian Error]', errorInfo);

  return errorInfo;
};

export const handleError = (error: Error | AppError | string, context?: Record<string, unknown>): ErrorInfo => {
  const errorInfo = logError(error, context);

  if (typeof window !== 'undefined') {
    if (error instanceof Error && error.name === 'TypeError') {
      console.warn('TypeError occurred, possibly due to missing dependencies:', error.message);
    }
  }

  return errorInfo;
};

export const reportError = async (errorInfo: ErrorInfo): Promise<void> => {
  try {
    console.log('Error reported:', errorInfo);
  } catch (e) {
    console.error('Failed to report error:', e);
  }
};

export const registerGlobalErrorHandler = (): void => {
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      handleError(event.error as Error, {
        eventType: 'window.error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      handleError(event.reason instanceof Error ? event.reason : String(event.reason), {
        eventType: 'unhandledrejection',
      });
    });
  }
};

export { AppError as default };