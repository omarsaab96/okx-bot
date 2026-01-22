import pino from "pino";
import { logStore } from "./logStore";

const base = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: { colorize: true }
  }
});

const baseInfo = base.info.bind(base) as (...args: any[]) => any;
const baseWarn = base.warn.bind(base) as (...args: any[]) => any;
const baseError = base.error.bind(base) as (...args: any[]) => any;
const baseDebug = base.debug.bind(base) as (...args: any[]) => any;

function wrap(level: "info" | "warn" | "error" | "debug") {
  return (...args: any[]) => {
    let msg = "";
    let data: unknown = undefined;
    if (typeof args[0] === "string") {
      msg = args[0];
    } else {
      data = args[0];
      msg = typeof args[1] === "string" ? args[1] : "";
    }
    logStore.add(level, msg, data);
    if (level === "info") return baseInfo(...args);
    if (level === "warn") return baseWarn(...args);
    if (level === "error") return baseError(...args);
    return baseDebug(...args);
  };
}

export const logger = Object.assign(base, {
  info: wrap("info"),
  warn: wrap("warn"),
  error: wrap("error"),
  debug: wrap("debug")
});
