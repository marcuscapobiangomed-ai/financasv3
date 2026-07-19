const ANALYTICS_KEY = "meu-financeiro-analytics";
const MAX_EVENTS = 2000;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export type EventType = "navigation" | "task" | "error" | "feedback" | "close_month";

export type AnalyticsEvent = {
  id: string;
  timestamp: string;
  type: EventType;
  category: string;
  action: string;
  duration?: number;
  metadata?: Record<string, number | string | boolean>;
};

function persist(events: AnalyticsEvent[]) {
  try { localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events)); } catch { /* ignore */ }
}

export function loadEvents(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function trim(events: AnalyticsEvent[]): AnalyticsEvent[] {
  const cutoff = Date.now() - RETENTION_MS;
  let trimmed = events.filter((e) => new Date(e.timestamp).getTime() > cutoff);
  if (trimmed.length > MAX_EVENTS) trimmed = trimmed.slice(-MAX_EVENTS);
  return trimmed;
}

function add(event: Omit<AnalyticsEvent, "id" | "timestamp">) {
  const events = loadEvents();
  events.push({ ...event, id: crypto.randomUUID(), timestamp: new Date().toISOString() });
  persist(trim(events));
}

export const analytics = {
  track(event: Omit<AnalyticsEvent, "id" | "timestamp">) {
    add(event);
    if (process.env.NODE_ENV === "development") {
      console.log(`[analytics] ${event.type}:${event.category}/${event.action}`, event.metadata ?? "");
    }
  },
  trackTimed(type: EventType, category: string, action: string, fn: () => void, metadata?: Record<string, number | string | boolean>) {
    const start = performance.now();
    try {
      fn();
      add({ type, category, action, duration: performance.now() - start, metadata: { ...metadata, success: true } });
    } catch (err) {
      add({ type, category, action, duration: performance.now() - start, metadata: { ...metadata, success: false, error: String(err) } });
      throw err;
    }
  },
  /** Track navigation between views */
  pageView(view: string, duration?: number) {
    add({ type: "navigation", category: "page", action: view, duration, metadata: duration ? undefined : { enter: true } });
  },
  /** Track task completion */
  task(action: string, metadata?: Record<string, number | string | boolean>) {
    add({ type: "task", category: "task", action, metadata: { ...metadata, completed: true } });
  },
  /** Track error events */
  error(action: string, metadata?: Record<string, number | string | boolean>) {
    add({ type: "error", category: "error", action, metadata });
  },
  /** Get aggregated stats */
  getStats() {
    const events = loadEvents();
    const now = Date.now();
    const last7d = events.filter((e) => now - new Date(e.timestamp).getTime() < 7 * 86400000);
    const last30d = events.filter((e) => now - new Date(e.timestamp).getTime() < 30 * 86400000);

    function byAction(evts: AnalyticsEvent[]) {
      const map = new Map<string, number>();
      evts.forEach((e) => {
        const key = `${e.category}:${e.action}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      });
      return [...map.entries()].sort((a, b) => b[1] - a[1]);
    }

    return {
      total: events.length,
      last7d: last7d.length,
      last30d: last30d.length,
      pageViews: byAction(events.filter((e) => e.type === "navigation")),
      tasksCompleted: byAction(events.filter((e) => e.type === "task" && e.metadata?.completed)),
      errors: events.filter((e) => e.type === "error"),
      errorCount: events.filter((e) => e.type === "error").length,
      feedbackCount: events.filter((e) => e.type === "feedback").length,
      avgTaskDuration: (() => {
        const tasks = events.filter((e) => e.duration !== undefined);
        return tasks.length ? tasks.reduce((s, e) => s + (e.duration ?? 0), 0) / tasks.length : 0;
      })(),
      topSlowTasks: (() => {
        const tasks = events.filter((e) => e.duration !== undefined && e.type === "task");
        return tasks.sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0)).slice(0, 10);
      })(),
      taskCompletionRate: (() => {
        const tasks = last30d.filter((e) => e.type === "task");
        if (!tasks.length) return 1;
        const succeeded = tasks.filter((e) => e.metadata?.success !== false).length;
        return succeeded / tasks.length;
      })(),
      monthClosings: events.filter((e) => e.type === "close_month").length,
    };
  },
  clear() {
    try { localStorage.removeItem(ANALYTICS_KEY); } catch { /* ignore */ }
  },
};
