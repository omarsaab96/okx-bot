import express from "express";
import path from "path";
import fs from "fs";
import { logStore } from "../util/logStore";
import { logger } from "../util/logger";
import { checkOkxConnectivity } from "../util/connectivity";

export type BotStatus = {
  running: boolean;
  tradingEnabled: boolean;
  lastTickAt?: number;
  lastSignal?: { type: string; reason?: string };
  lastError?: string;
  position?: unknown;
  risk?: unknown;
  market?: { instId: string; marketType: string; mode: string };
};

export type BotControl = {
  start: () => void;
  stop: () => void;
  status: () => BotStatus;
  config: () => unknown;
};

export function startDashboard(control: BotControl, port: number) {
  const app = express();
  app.use(express.json());

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
    res.json({ items: logStore.list(Number.isFinite(limit) ? limit : 200) });
  });

  app.get("/api/config", (_req, res) => {
    res.json(control.config());
  });

  app.get("/api/connectivity", async (_req, res) => {
    const result = await checkOkxConnectivity();
    res.json(result);
  });

  app.get("/api/hourly", (req, res) => {
    const limit = Number(req.query.limit || "48");
    const logsDir = path.join(process.cwd(), "logs");
    let files: string[] = [];
    try {
      files = fs.readdirSync(logsDir).filter((f) => f.startsWith("hourly-") && f.endsWith(".json"));
    } catch {
      res.json({ items: [] });
      return;
    }
    files.sort();
    const slice = files.slice(Math.max(0, files.length - (Number.isFinite(limit) ? limit : 48)));
    const items = slice.map((f) => {
      const full = path.join(logsDir, f);
      try {
        const data = JSON.parse(fs.readFileSync(full, "utf-8"));
        return { file: f, data };
      } catch {
        return { file: f, data: null };
      }
    });
    res.json({ items });
  });

  const publicDir = path.join(process.cwd(), "public");
  app.use(express.static(publicDir));

  app.listen(port, () => {
    logger.info({ port }, "Dashboard listening");
  });
}
