"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDashboard = startDashboard;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logStore_1 = require("../util/logStore");
const logger_1 = require("../util/logger");
const connectivity_1 = require("../util/connectivity");
function startDashboard(control, port) {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.get("/api/status", (_req, res) => {
        res.json(control.status());
    });
    app.post("/api/start", (_req, res) => {
        control.start();
        res.json({ ok: true });
    });
    app.post("/api/stop", (_req, res) => {
        control.stop();
        res.json({ ok: true });
    });
    app.get("/api/logs", (req, res) => {
        const limit = Number(req.query.limit || "200");
        res.json({ items: logStore_1.logStore.list(Number.isFinite(limit) ? limit : 200) });
    });
    app.get("/api/config", (_req, res) => {
        res.json(control.config());
    });
    app.get("/api/connectivity", async (_req, res) => {
        const result = await (0, connectivity_1.checkOkxConnectivity)();
        res.json(result);
    });
    app.get("/api/hourly", (req, res) => {
        const limit = Number(req.query.limit || "48");
        const logsDir = path_1.default.join(process.cwd(), "logs");
        let files = [];
        try {
            files = fs_1.default.readdirSync(logsDir).filter((f) => f.startsWith("hourly-") && f.endsWith(".json"));
        }
        catch {
            res.json({ items: [] });
            return;
        }
        files.sort();
        const slice = files.slice(Math.max(0, files.length - (Number.isFinite(limit) ? limit : 48)));
        const items = slice.map((f) => {
            const full = path_1.default.join(logsDir, f);
            try {
                const data = JSON.parse(fs_1.default.readFileSync(full, "utf-8"));
                return { file: f, data };
            }
            catch {
                return { file: f, data: null };
            }
        });
        res.json({ items });
    });
    const publicDir = path_1.default.join(process.cwd(), "public");
    app.use(express_1.default.static(publicDir));
    app.listen(port, () => {
        logger_1.logger.info({ port }, "Dashboard listening");
    });
}
