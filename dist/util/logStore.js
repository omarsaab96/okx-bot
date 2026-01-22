"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logStore = void 0;
class LogStore {
    constructor(maxEntries = 1000) {
        this.maxEntries = maxEntries;
        this.buffer = [];
    }
    add(level, msg, data) {
        const entry = { ts: new Date().toISOString(), level, msg, data };
        this.buffer.push(entry);
        if (this.buffer.length > this.maxEntries) {
            this.buffer.splice(0, this.buffer.length - this.maxEntries);
        }
    }
    list(limit = 200) {
        if (limit <= 0)
            return [];
        const start = Math.max(0, this.buffer.length - limit);
        return this.buffer.slice(start);
    }
}
exports.logStore = new LogStore();
