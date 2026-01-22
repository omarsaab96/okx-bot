export type LogEntry = {
  ts: string;
  level: string;
  msg: string;
  data?: unknown;
};

class LogStore {
  private buffer: LogEntry[] = [];
  constructor(private readonly maxEntries = 1000) {}

  add(level: string, msg: string, data?: unknown) {
    const entry: LogEntry = { ts: new Date().toISOString(), level, msg, data };
    this.buffer.push(entry);
    if (this.buffer.length > this.maxEntries) {
      this.buffer.splice(0, this.buffer.length - this.maxEntries);
    }
  }

  list(limit = 200): LogEntry[] {
    if (limit <= 0) return [];
    const start = Math.max(0, this.buffer.length - limit);
    return this.buffer.slice(start);
  }
}

export const logStore = new LogStore();
