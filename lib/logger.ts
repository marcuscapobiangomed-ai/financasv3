const LOG_KEY = "meu-financeiro-logs";
const MAX_LOGS = 500;

export type LogLevel = "info" | "warn" | "error" | "debug";
export type LogCategory =
  | "import"
  | "export"
  | "auth"
  | "sync"
  | "calculation"
  | "performance"
  | "storage"
  | "security"
  | "ui"
  | "system";

export type LogEntry = {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: Record<string, unknown>;
  duration?: number;
};

const SENSITIVE_PATTERNS = [
  /token\s*[:=]\s*\S+/gi,
  /password\s*[:=]\s*\S+/gi,
  /senha\s*[:=]\s*\S+/gi,
  /secret\s*[:=]\s*\S+/gi,
  /api[_-]?key\s*[:=]\s*\S+/gi,
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
  /\b\d{11}\b/g,
  /\b\d{14}\b/g,
];

function sanitize(value: unknown): unknown {
  if (typeof value === "string") {
    let s = value;
    for (const pattern of SENSITIVE_PATTERNS) {
      s = s.replace(pattern, "[REDACTED]");
    }
    return s;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lowerKey = k.toLowerCase();
      if (/token|password|senha|secret|api[_-]?key|cvv|pin/i.test(lowerKey)) {
        result[k] = "[REDACTED]";
      } else {
        result[k] = sanitize(v);
      }
    }
    return result;
  }
  return value;
}

export function createLogger() {
  function persist(entry: LogEntry) {
    try {
      const stored = loadAll();
      stored.push(entry);
      while (stored.length > MAX_LOGS) stored.shift();
      localStorage.setItem(LOG_KEY, JSON.stringify(stored));
    } catch {
      // Silently fail — logging must never break the app
    }
  }

  function loadAll(): LogEntry[] {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function log(level: LogLevel, category: LogCategory, message: string, context?: Record<string, unknown>, duration?: number) {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      context: context ? (sanitize(context) as Record<string, unknown>) : undefined,
      duration,
    };
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      fn(`[${category}] ${message}`, context ?? "");
    }
    persist(entry);
  }

  return {
    info: (category: LogCategory, message: string, context?: Record<string, unknown>) => log("info", category, message, context),
    warn: (category: LogCategory, message: string, context?: Record<string, unknown>) => log("warn", category, message, context),
    error: (category: LogCategory, message: string, context?: Record<string, unknown>) => log("error", category, message, context),
    debug: (category: LogCategory, message: string, context?: Record<string, unknown>) => log("debug", category, message, context),
    timed: (category: LogCategory, message: string, fn: () => unknown, context?: Record<string, unknown>) => {
      const start = performance.now();
      try {
        const result = fn();
        const duration = performance.now() - start;
        log("info", category, message, { ...context, duration: `${duration.toFixed(1)}ms` }, duration);
        return result;
      } catch (err) {
        const duration = performance.now() - start;
        log("error", category, `${message} — failed`, { ...context, error: String(err), duration: `${duration.toFixed(1)}ms` }, duration);
        throw err;
      }
    },
    loadAll,
    clear: () => {
      try { localStorage.removeItem(LOG_KEY); } catch { /* ignore */ }
    },
    getStats: () => {
      const logs = loadAll();
      return {
        total: logs.length,
        byLevel: logs.reduce((acc, l) => { acc[l.level] = (acc[l.level] || 0) + 1; return acc; }, {} as Record<string, number>),
        byCategory: logs.reduce((acc, l) => { acc[l.category] = (acc[l.category] || 0) + 1; return acc; }, {} as Record<string, number>),
        errors: logs.filter((l) => l.level === "error").length,
        last24h: logs.filter((l) => Date.now() - new Date(l.timestamp).getTime() < 86400000).length,
        avgDuration: (() => {
          const withDuration = logs.filter((l) => l.duration !== undefined);
          return withDuration.length ? withDuration.reduce((s, l) => s + (l.duration ?? 0), 0) / withDuration.length : 0;
        })(),
      };
    },
  };
}

export const logger = createLogger();
