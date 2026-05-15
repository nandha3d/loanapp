/**
 * Structured Logger
 * 
 * Replaces ad-hoc console.log/error calls with structured JSON output
 * containing level, message, tenantId, userId, action, and timestamp.
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  tenantId?: string;
  userId?: string;
  action?: string;
  [key: string]: any;
}

function formatLog(level: LogLevel, message: string, context?: LogContext) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  // Convert to single-line JSON string for structured logging systems (e.g. Datadog, ELK)
  return JSON.stringify(logEntry);
}

export const logger = {
  info: (message: string, context?: LogContext) => {
    console.log(formatLog('info', message, context));
  },
  warn: (message: string, context?: LogContext) => {
    console.warn(formatLog('warn', message, context));
  },
  error: (message: string, error?: any, context?: LogContext) => {
    console.error(formatLog('error', message, {
      ...context,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    }));
  },
};
