"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const logStore_1 = require("./logStore");
const base = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || "info",
    transport: {
        target: "pino-pretty",
        options: { colorize: true }
    }
});
const baseInfo = base.info.bind(base);
const baseWarn = base.warn.bind(base);
const baseError = base.error.bind(base);
const baseDebug = base.debug.bind(base);
function wrap(level) {
    return (...args) => {
        let msg = "";
        let data = undefined;
        if (typeof args[0] === "string") {
            msg = args[0];
        }
        else {
            data = args[0];
            msg = typeof args[1] === "string" ? args[1] : "";
        }
        logStore_1.logStore.add(level, msg, data);
        if (level === "info")
            return baseInfo(...args);
        if (level === "warn")
            return baseWarn(...args);
        if (level === "error")
            return baseError(...args);
        return baseDebug(...args);
    };
}
exports.logger = Object.assign(base, {
    info: wrap("info"),
    warn: wrap("warn"),
    error: wrap("error"),
    debug: wrap("debug")
});
