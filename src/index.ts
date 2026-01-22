import fs from "fs";
import path from "path";
import { config } from "./config";
import { logger } from "./util/logger";
import { sleep } from "./util/sleep";
import { utcDayKey, utcHourKey } from "./util/time";
import { roundPriceDown, roundSizeDown, decimalsFromStep } from "./util/rounding";
import { getCandles, getInstrument, getOrder, getAlgoOrder, getUsdtBalance, placeMarketBuyBase, placeTpSlConditional, placeMarketSwap, setLeverage } from "./okx/client";
import { initialState } from "./state/store";
import { canTrade } from "./risk/risk";
import { buildSignal } from "./strategy/signal";
import { buildReport } from "./state/report";
import { startDashboard } from "./server/dashboard";

function toNums(candles: any[]) {
  // OKX candles are returned newest-first usually; we reverse to oldest-first
  const arr = candles.slice().reverse();
  const close = arr.map((c) => Number(c[4]));
  const high = arr.map((c) => Number(c[2]));
  const low = arr.map((c) => Number(c[3]));
  return { close, high, low };
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function minutesBetween(a: number, b: number) {
  return Math.max(0, Math.round((b - a) / 60000));
}

type BotRuntime = {
  running: boolean;
  tradingEnabled: boolean;
  lastTickAt?: number;
  lastSignal?: { type: string; reason?: string };
  lastError?: string;
  position?: any;
  risk?: any;
  balance?: { usdt: number; tradeUsdt: number };
};

const runtime: BotRuntime = {
  running: false,
  tradingEnabled: config.bot.autoStart
};

async function startBotLoop() {
  if (runtime.running) return;
  runtime.running = true;
  runtime.lastError = undefined;

  logger.info({ instId: config.bot.instId, simulated: config.okx.simulated, mode: config.bot.mode }, "Bot starting");

  ensureDir(path.join(process.cwd(), "logs"));

  let minSz = 0;
  let lotSz = 0;
  let tickSz = 0;
  let szDec = 0;
  let pxDec = 0;
  let ctVal: number | undefined = undefined;
  const instType = config.bot.marketType === "SWAP" ? "SWAP" : "SPOT";

  while (runtime.running) {
    try {
      // Instrument filters (retry on network failures)
      const inst = await getInstrument(config.bot.instId, instType);
      minSz = Number(inst.minSz || "0.00001");
      lotSz = Number(inst.lotSz || inst.minSz || "0.00001");
      tickSz = Number(inst.tickSz || "0.1");
      szDec = decimalsFromStep(lotSz);
      pxDec = decimalsFromStep(tickSz);
      ctVal = config.bot.marketType === "SWAP" ? Number(inst.ctVal || "0") : undefined;

      logger.info({ minSz, lotSz, tickSz, ctVal, instType }, "Instrument filters loaded");

      if (config.bot.marketType === "SWAP") {
        if (!ctVal || !Number.isFinite(ctVal) || ctVal <= 0) {
          throw new Error(`Invalid ctVal for ${config.bot.instId}. Ensure BOT_INST_ID is a SWAP instrument.`);
        }
        const leverStr = String(config.bot.leverage || 1);
        if (config.bot.positionMode === "hedge") {
          await setLeverage({ instId: config.bot.instId, lever: leverStr, mgnMode: config.bot.mgnMode, posSide: "long" });
          await setLeverage({ instId: config.bot.instId, lever: leverStr, mgnMode: config.bot.mgnMode, posSide: "short" });
        } else {
          await setLeverage({ instId: config.bot.instId, lever: leverStr, mgnMode: config.bot.mgnMode });
        }
        logger.info({ leverage: leverStr, mgnMode: config.bot.mgnMode, positionMode: config.bot.positionMode }, "Leverage set");
      }

      break;
    } catch (err: any) {
      runtime.lastError = err?.message || String(err);
      logger.error({ err: runtime.lastError }, "Instrument init failed; retrying");
      await sleep(Math.max(5, config.bot.pollSeconds) * 1000);
    }
  }

  // Day init
  const day0 = utcDayKey();
  const startBal0 = await getUsdtBalance();
  const budget0 = config.risk.tradeBudgetUsdt > 0 ? config.risk.tradeBudgetUsdt : undefined;
  const startTradeUsdt0 = budget0 ? Math.min(startBal0, budget0) : startBal0;
  logger.info({ availableBalanceUSDT: startBal0, tradingBudgetUSDT: startTradeUsdt0 }, "Initial USDT balance");
  let state = initialState(day0, startTradeUsdt0);
  let hourKey = utcHourKey();
  let hourStartBalance = startBal0;
  let hourTrades0 = 0;
  let hourWins0 = 0;
  let hourLosses0 = 0;
  let hourPnl0 = 0;

  while (runtime.running) {
    try {
      runtime.lastTickAt = Date.now();
      const dayNow = utcDayKey();
      const hourNow = utcHourKey();
      let usdt: number;
      let tradeUsdt: number;

      // Day rollover -> emit report and reset state
      if (state.risk.dayKey !== dayNow) {
        const endBal = await getUsdtBalance();
        const endTradeUsdt = budget0 ? Math.min(endBal, budget0) : endBal;

        const report = buildReport({
          dateUtc: state.risk.dayKey,
          startBalance: state.risk.startBalance,
          endBalance: endTradeUsdt,
          trades: state.risk.trades,
          wins: state.risk.wins,
          losses: state.risk.losses,
          maxDrawdown: state.risk.maxDrawdown,
          largestWin: state.risk.largestWin,
          largestLoss: state.risk.largestLoss,
          cooldownMinutes: state.risk.cooldownMinutesToday
        });

        logger.info({ report }, "DAILY_REPORT");
        fs.writeFileSync(path.join("logs", `${state.risk.dayKey}.json`), JSON.stringify(report, null, 2), "utf-8");

        // reset
        state = initialState(dayNow, endTradeUsdt);
        usdt = endBal;
        tradeUsdt = endTradeUsdt;
        hourKey = utcHourKey();
        hourStartBalance = endTradeUsdt;
        hourTrades0 = 0;
        hourWins0 = 0;
        hourLosses0 = 0;
        hourPnl0 = 0;
      } else {
        usdt = await getUsdtBalance();
        tradeUsdt = budget0 ? Math.min(usdt, budget0) : usdt;
      }
      runtime.balance = { usdt, tradeUsdt };

      // Hourly report (snapshot of deltas within the hour)
      if (hourKey !== hourNow) {
        const hourlyReport = {
          hourUtc: hourKey,
          startBalance: hourStartBalance,
          endBalance: tradeUsdt,
          trades: state.risk.trades - hourTrades0,
          wins: state.risk.wins - hourWins0,
          losses: state.risk.losses - hourLosses0,
          pnl: state.risk.pnlToday - hourPnl0,
          budgetUsdt: budget0
        };

        fs.writeFileSync(path.join("logs", `hourly-${hourKey}.json`), JSON.stringify(hourlyReport, null, 2), "utf-8");

        hourKey = hourNow;
        hourStartBalance = tradeUsdt;
        hourTrades0 = state.risk.trades;
        hourWins0 = state.risk.wins;
        hourLosses0 = state.risk.losses;
        hourPnl0 = state.risk.pnlToday;
      }

      if (tradeUsdt < config.risk.minUsdtBalance) {
        logger.warn({ usdt, tradeUsdt }, "USDT balance below MIN_USDT_BALANCE; waiting");
        await sleep(config.bot.pollSeconds * 1000);
        continue;
      }

      // update drawdown stats (equity approximated by USDT balance in spot demo; for live you may hold BTC briefly)
      state.risk.maxEquity = Math.max(state.risk.maxEquity, tradeUsdt);
      const dd = (state.risk.maxEquity - tradeUsdt);
      state.risk.maxDrawdown = Math.max(state.risk.maxDrawdown, dd);

      // Daily loss halt (soft): based on start-of-day USDT balance
      const dailyLoss = (state.risk.startBalance - tradeUsdt);
      if (!state.risk.dailyHalt && dailyLoss / state.risk.startBalance >= config.risk.maxDailyLoss) {
        state.risk.dailyHalt = true;
        logger.warn({ dailyLoss, start: state.risk.startBalance }, "Max daily loss reached -> halting until next UTC day");
      }

      // Cooldown tracking
      if (state.risk.haltedUntil && Date.now() < state.risk.haltedUntil) {
        const minsLeft = minutesBetween(Date.now(), state.risk.haltedUntil);
        logger.info({ minsLeft }, "Cooldown active");
      }

      runtime.position = state.position;
      runtime.risk = state.risk;

      if (!runtime.tradingEnabled) {
        logger.info("Trading paused; monitoring only");
        await sleep(config.bot.pollSeconds * 1000);
        continue;
      }

      const ok = canTrade(state.risk);
      if (!ok.ok) {
        await sleep(config.bot.pollSeconds * 1000);
        continue;
      }

      // If position open, monitor closure via algo order status
      if (state.position) {
        const pos = state.position;
        const algo = await getAlgoOrder(pos.algoId);

        // Algo state docs include: live, effective, canceled, etc.
        if (algo.state === "effective" || algo.state === "partially_effective") {
          // should have ordIdList of resulting orders (TP/SL splits). We'll try to compute exit avg from those.
          const ordIds = (algo.ordIdList || []).filter(Boolean);
          let exitAvg = 0;
          let exitSz = 0;
          let exitFeeUsdt = 0;

          for (const oid of ordIds) {
            try {
              const od = await getOrder(pos.instId, oid);
              if (od.state !== "filled") continue;
              const px = Number(od.avgPx || "0");
              const sz = Number(od.accFillSz || "0");
              const fee = Number(od.fee || "0"); // fee might be negative; feeCcy could be USDT or BTC
              const feeCcy = od.feeCcy;

              exitAvg += px * sz;
              exitSz += sz;

              // Convert fee to USDT approx when fee is in USDT; otherwise ignore (conservative)
              if (feeCcy === "USDT") exitFeeUsdt += fee;
            } catch {
              // ignore individual order errors
            }
          }

          // Fallback if ordIdList empty or not filled yet
          if (exitSz > 0) {
            exitAvg = exitAvg / exitSz;
          } else {
            exitAvg = Number(algo.actualPx || "0") || 0;
            exitSz = Number(algo.actualSz || "0") || (pos.entrySz || 0);
          }

          // Ensure we have entry details
          if (!pos.entryAvgPx || !pos.entrySz) {
            const entry = await getOrder(pos.instId, pos.entryOrdId);
            pos.entryAvgPx = Number(entry.avgPx || "0");
            pos.entrySz = Number(entry.accFillSz || "0");
          }

          const entryPx = pos.entryAvgPx || pos.intendedEntry;
          const qty = Math.min(pos.entrySz || exitSz, exitSz || pos.entrySz || 0);

          let pnl = 0;
          if (pos.szUnit === "BTC") {
            const dir = pos.side === "LONG" ? 1 : -1;
            pnl = (exitAvg - entryPx) * qty * dir + exitFeeUsdt;
          } else {
            const baseQty = qty * (pos.ctVal || 0);
            const dir = pos.side === "LONG" ? 1 : -1;
            pnl = (exitAvg - entryPx) * baseQty * dir + exitFeeUsdt;
          }

          state.risk.trades += 1;
          state.risk.pnlToday += pnl;

          if (pnl >= 0) {
            state.risk.wins += 1;
            state.risk.consecutiveLosses = 0;
            state.risk.largestWin = Math.max(state.risk.largestWin, pnl);
          } else {
            state.risk.losses += 1;
            state.risk.consecutiveLosses += 1;
            state.risk.largestLoss = Math.min(state.risk.largestLoss, pnl);
          }

          logger.info({ pnl, entryPx, exitAvg, qty, algoState: algo.state, ordIds }, "Position closed");

          // Loss streak cooldown
          if (state.risk.consecutiveLosses >= config.risk.lossStreak) {
            const start = Date.now();
            const until = start + config.risk.lossCooldownMinutes * 60_000;
            state.risk.haltedUntil = until;
            state.risk.cooldownMinutesToday += config.risk.lossCooldownMinutes;
            logger.warn({ until: new Date(until).toISOString() }, "Loss streak hit -> cooldown");
          }

          state.position = null;
        } else if (algo.state === "canceled" || algo.state === "order_failed" || algo.state === "partially_failed") {
          logger.warn({ algoState: algo.state }, "Algo order ended without execution; position safety may be compromised. Consider manual review.");
          // We do not auto-close here for safety; leave position tracking but set dailyHalt.
          state.risk.dailyHalt = true;
        } else {
          logger.info({ algoState: algo.state }, "Position open; waiting for TP/SL");
        }

        await sleep(config.bot.pollSeconds * 1000);
        continue;
      }

      // Fetch candles
      const c15 = await getCandles(config.bot.instId, config.strat.entryTf, 300);
      const c1h = await getCandles(config.bot.instId, config.strat.trendTf, 300);
      if (c15.code !== "0" || c1h.code !== "0") {
        logger.warn({ c15: c15.msg, c1h: c1h.msg }, "Candle fetch error");
        await sleep(config.bot.pollSeconds * 1000);
        continue;
      }

      const v15 = toNums(c15.data);
      const v1h = toNums(c1h.data);

      const sig = buildSignal({
        close15m: v15.close,
        high15m: v15.high,
        low15m: v15.low,
        close1h: v1h.close,
        usdtBalance: tradeUsdt,
        riskPerTrade: config.risk.riskPerTrade,
        trendEmaLen: config.strat.trendEma,
        trendMinPct: config.strat.trendMinPct,
        atrLen: config.strat.atrLen,
        slAtrMult: config.strat.slAtrMult,
        tpRMultBreakout: config.strat.tpRMultBreakout,
        tpRMultPullback: config.strat.tpRMultPullback,
        tpRMultMomentum: config.strat.tpRMultMomentum,
        tpRMultMeanRev: config.strat.tpRMultMeanRev,
        pullbackEmaLen: config.strat.pullbackEmaLen,
        momentumEmaFast: config.strat.momentumEmaFast,
        momentumEmaSlow: config.strat.momentumEmaSlow,
        rsiLen: config.strat.rsiLen,
        rsiOverbought: config.strat.rsiOverbought,
        rsiOversold: config.strat.rsiOversold,
        bbLen: config.strat.bbLen,
        bbStd: config.strat.bbStd
      });

      if (sig.type === "NONE") {
        runtime.lastSignal = { type: sig.type, reason: sig.reason };
        logger.info({ reason: sig.reason }, "No signal");
        await sleep(config.bot.pollSeconds * 1000);
        continue;
      }

      if (sig.type === "SHORT" && config.bot.marketType === "SPOT") {
        runtime.lastSignal = { type: sig.type, reason: sig.reason };
        logger.warn({ reason: sig.reason, mode: config.bot.mode }, "Short signal ignored in SPOT mode");
        await sleep(config.bot.pollSeconds * 1000);
        continue;
      }

      // --- sizing & rounding ---
      let sizeBtc = sig.sizeBtc;

      // cap buy size by USDT balance and max position percent
      const maxAffordableBtc = tradeUsdt / sig.entry;
      const maxPosBtc = (tradeUsdt * config.risk.maxPositionPct) / sig.entry;
      sizeBtc = Math.min(sizeBtc, maxAffordableBtc, maxPosBtc);

      const slPx = roundPriceDown(sig.sl, tickSz);
      const tpPx = roundPriceDown(sig.tp, tickSz);

      let szStr = "";
      let szUnit: "BTC" | "CONTRACTS" = "BTC";
      if (config.bot.marketType === "SPOT") {
        sizeBtc = roundSizeDown(sizeBtc, lotSz);
        if (sizeBtc < minSz) {
          logger.warn({ sizeBtc, minSz }, "Computed size below minSz; skipping");
          await sleep(config.bot.pollSeconds * 1000);
          continue;
        }
        szStr = sizeBtc.toFixed(szDec);
        szUnit = "BTC";
      } else {
        const sizeContracts = roundSizeDown(sizeBtc / (ctVal || 1), lotSz);
        if (sizeContracts < minSz) {
          logger.warn({ sizeContracts, minSz }, "Computed size below minSz; skipping");
          await sleep(config.bot.pollSeconds * 1000);
          continue;
        }
        szStr = sizeContracts.toFixed(szDec);
        szUnit = "CONTRACTS";
      }

      const slStr = slPx.toFixed(pxDec);
      const tpStr = tpPx.toFixed(pxDec);

      const isLong = sig.type === "LONG";
      runtime.lastSignal = { type: sig.type, reason: sig.reason };
      const entrySide = isLong ? "buy" : "sell";
      const exitSide = isLong ? "sell" : "buy";
      const posSide = config.bot.positionMode === "hedge" ? (isLong ? "long" : "short") : undefined;

      logger.info({ sig, usdt, tradeUsdt, szStr, slStr, tpStr, marketType: config.bot.marketType }, "Placing trade (market) with TP/SL conditional");

      // 1) Entry market order
      const entryOrdId = config.bot.marketType === "SPOT"
        ? await placeMarketBuyBase(config.bot.instId, szStr)
        : await placeMarketSwap({
            instId: config.bot.instId,
            side: entrySide,
            szContracts: szStr,
            tdMode: config.bot.mgnMode,
            posSide
          });

      // 2) Attach TP/SL conditional algo
      const algoId = await placeTpSlConditional({
        instId: config.bot.instId,
        side: exitSide,
        szBase: szStr,
        tpTriggerPx: tpStr,
        slTriggerPx: slStr,
        reduceOnly: config.bot.marketType === "SWAP",
        tdMode: config.bot.marketType === "SWAP" ? config.bot.mgnMode : "cash",
        posSide
      });

      // 3) Fetch actual entry avg price (best effort)
      let entryAvgPx: number | undefined;
      let entrySz: number | undefined;
      try {
        const od = await getOrder(config.bot.instId, entryOrdId);
        entryAvgPx = Number(od.avgPx || "0") || undefined;
        entrySz = Number(od.accFillSz || "0") || undefined;
      } catch {
        // ignore
      }

      state.position = {
        side: sig.type,
        instId: config.bot.instId,
        intendedEntry: sig.entry,
        intendedSl: sig.sl,
        intendedTp: sig.tp,
        entryOrdId,
        entryAvgPx,
        entrySz,
        szUnit,
        ctVal: config.bot.marketType === "SWAP" ? ctVal : undefined,
        algoId,
        openedAt: Date.now()
      };

      logger.info({ entryOrdId, algoId, entryAvgPx, entrySz, szUnit }, "Position opened");

      await sleep(config.bot.pollSeconds * 1000);
    } catch (err: any) {
      logger.error({ err: err?.message || err }, "Loop error");
      runtime.lastError = err?.message || String(err);
      await sleep(config.bot.pollSeconds * 1000);
    }
  }
}

function startTrading() {
  runtime.tradingEnabled = true;
  logger.info("Trading enabled");
}

function stopTrading() {
  runtime.tradingEnabled = false;
  logger.warn("Trading paused");
}

function safeConfig() {
  return {
    bot: config.bot,
    risk: config.risk,
    strat: config.strat,
    dashboard: config.dashboard,
    okx: { simulated: config.okx.simulated, baseUrl: config.okx.baseUrl }
  };
}

async function main() {
  startDashboard(
    {
      start: startTrading,
      stop: stopTrading,
      status: () => ({
        running: runtime.running,
        tradingEnabled: runtime.tradingEnabled,
        lastTickAt: runtime.lastTickAt,
        lastSignal: runtime.lastSignal,
        lastError: runtime.lastError,
        position: runtime.position,
        risk: runtime.risk,
        balance: runtime.balance,
        market: { instId: config.bot.instId, marketType: config.bot.marketType, mode: config.bot.mode }
      }),
      config: safeConfig
    },
    config.dashboard.port
  );

  await startBotLoop();
}

main().catch((e) => {
  logger.error({ err: e?.message || e }, "Fatal error");
  process.exit(1);
});
