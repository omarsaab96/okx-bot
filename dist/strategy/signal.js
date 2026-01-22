"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSignal = buildSignal;
const indicators_1 = require("./indicators");
const swings_1 = require("./swings");
function buildSignal(params) {
    const { close15m, high15m, low15m, close1h } = params;
    if (close15m.length < 250 || close1h.length < 250)
        return { type: "NONE", reason: "not_enough_data" };
    // ===== Trend filter (1H EMA) =====
    const emaTrend = (0, indicators_1.ema)(close1h, params.trendEmaLen);
    if (emaTrend.length === 0)
        return { type: "NONE", reason: "trend_ema_not_ready" };
    const trendNow = emaTrend[emaTrend.length - 1];
    const trendPct = (close1h[close1h.length - 1] - trendNow) / trendNow;
    const trendBull = trendPct > params.trendMinPct;
    const trendBear = trendPct < -params.trendMinPct;
    const trendFlat = !trendBull && !trendBear;
    // ===== Price & ATR on 15m =====
    const price = close15m[close15m.length - 1];
    const prevClose = close15m[close15m.length - 2];
    const atrArr = (0, indicators_1.atr)(high15m, low15m, close15m, params.atrLen);
    if (atrArr.length === 0)
        return { type: "NONE", reason: "atr_not_ready" };
    const atrNow = atrArr[atrArr.length - 1];
    const stopDist = atrNow * params.slAtrMult;
    // Position sizing (spot): risk in USDT / stop distance -> BTC size
    const riskUsdt = params.usdtBalance * params.riskPerTrade;
    const sizeBtc = riskUsdt / stopDist;
    if (!Number.isFinite(sizeBtc) || sizeBtc <= 0)
        return { type: "NONE", reason: "bad_size" };
    // ===== Indicators for entries =====
    const emaPullArr = (0, indicators_1.ema)(close15m, params.pullbackEmaLen);
    if (emaPullArr.length === 0)
        return { type: "NONE", reason: "ema_pullback_not_ready" };
    const emaPullNow = emaPullArr[emaPullArr.length - 1];
    const emaFastArr = (0, indicators_1.ema)(close15m, params.momentumEmaFast);
    const emaSlowArr = (0, indicators_1.ema)(close15m, params.momentumEmaSlow);
    if (emaFastArr.length === 0 || emaSlowArr.length === 0)
        return { type: "NONE", reason: "ema_momentum_not_ready" };
    const emaFastNow = emaFastArr[emaFastArr.length - 1];
    const emaSlowNow = emaSlowArr[emaSlowArr.length - 1];
    const rsiArr = (0, indicators_1.rsi)(close15m, params.rsiLen);
    if (rsiArr.length === 0)
        return { type: "NONE", reason: "rsi_not_ready" };
    const rsiNow = rsiArr[rsiArr.length - 1];
    const bbMidArr = (0, indicators_1.sma)(close15m, params.bbLen);
    const bbSdArr = (0, indicators_1.stdev)(close15m, params.bbLen);
    if (bbMidArr.length === 0 || bbSdArr.length === 0)
        return { type: "NONE", reason: "bb_not_ready" };
    const bbMid = bbMidArr[bbMidArr.length - 1];
    const bbSd = bbSdArr[bbSdArr.length - 1];
    const bbUpper = bbMid + bbSd * params.bbStd;
    const bbLower = bbMid - bbSd * params.bbStd;
    // ===== Entry #1: Breakout =====
    const sh = (0, swings_1.lastSwingHigh)(high15m, 30);
    const breakoutUp = sh != null && prevClose <= sh && price > sh;
    const sl = (0, swings_1.lastSwingLow)(low15m, 30);
    const breakoutDown = sl != null && prevClose >= sl && price < sl;
    // ===== Entry #2: Pullback continuation =====
    // Logic:
    // - In trend direction
    // - If price pulls to EMA and then reclaims it -> continuation
    const zone = atrNow * 0.5;
    const lastLow = low15m[low15m.length - 1];
    const lastHigh = high15m[high15m.length - 1];
    const touchedZone = lastLow <= (emaPullNow + zone) &&
        lastLow >= (emaPullNow - 4 * zone); // avoid extreme dumps
    const touchedZoneShort = lastHigh >= (emaPullNow - zone) &&
        lastHigh <= (emaPullNow + 4 * zone); // avoid extreme spikes
    // Reclaim: price closes back above EMA after touching it
    const reclaimLong = lastLow <= emaPullNow && price > emaPullNow;
    const pullbackLong = touchedZone && reclaimLong;
    const reclaimShort = lastHigh >= emaPullNow && price < emaPullNow;
    const pullbackShort = touchedZoneShort && reclaimShort;
    // ===== Entry #3: Momentum continuation =====
    const momentumLong = emaFastNow > emaSlowNow && price > emaSlowNow && rsiNow > 55;
    const momentumShort = emaFastNow < emaSlowNow && price < emaSlowNow && rsiNow < 45;
    // ===== Entry #4: Mean reversion (range-biased) =====
    const meanRevLong = rsiNow <= params.rsiOversold && price <= bbLower;
    const meanRevShort = rsiNow >= params.rsiOverbought && price >= bbUpper;
    const candidates = [];
    if (trendBull) {
        if (breakoutUp)
            candidates.push({ type: "LONG", reason: "breakout", priority: 4, tpRMult: params.tpRMultBreakout });
        if (pullbackLong)
            candidates.push({ type: "LONG", reason: "pullback_ema", priority: 3, tpRMult: params.tpRMultPullback });
        if (momentumLong)
            candidates.push({ type: "LONG", reason: "momentum", priority: 2, tpRMult: params.tpRMultMomentum });
        if (meanRevLong)
            candidates.push({ type: "LONG", reason: "mean_reversion", priority: 1, tpRMult: params.tpRMultMeanRev });
    }
    if (trendBear) {
        if (breakoutDown)
            candidates.push({ type: "SHORT", reason: "breakout", priority: 4, tpRMult: params.tpRMultBreakout });
        if (pullbackShort)
            candidates.push({ type: "SHORT", reason: "pullback_ema", priority: 3, tpRMult: params.tpRMultPullback });
        if (momentumShort)
            candidates.push({ type: "SHORT", reason: "momentum", priority: 2, tpRMult: params.tpRMultMomentum });
        if (meanRevShort)
            candidates.push({ type: "SHORT", reason: "mean_reversion", priority: 1, tpRMult: params.tpRMultMeanRev });
    }
    if (trendFlat) {
        if (meanRevLong)
            candidates.push({ type: "LONG", reason: "mean_reversion", priority: 3, tpRMult: params.tpRMultMeanRev });
        if (meanRevShort)
            candidates.push({ type: "SHORT", reason: "mean_reversion", priority: 3, tpRMult: params.tpRMultMeanRev });
    }
    if (candidates.length > 0) {
        candidates.sort((a, b) => b.priority - a.priority);
        const pick = candidates[0];
        const entry = price;
        const slPx = pick.type === "LONG" ? entry - stopDist : entry + stopDist;
        const tpPx = pick.type === "LONG" ? entry + stopDist * pick.tpRMult : entry - stopDist * pick.tpRMult;
        return {
            type: pick.type,
            entry,
            sl: slPx,
            tp: tpPx,
            sizeBtc,
            reason: pick.reason
        };
    }
    return { type: "NONE", reason: "no_signal" };
}
