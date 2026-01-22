"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCandles = getCandles;
exports.getInstrument = getInstrument;
exports.getUsdtBalance = getUsdtBalance;
exports.getOrder = getOrder;
exports.getAlgoOrder = getAlgoOrder;
exports.placeMarketBuyBase = placeMarketBuyBase;
exports.placeTpSlConditional = placeTpSlConditional;
exports.placeMarketBuyQuote = placeMarketBuyQuote;
exports.setLeverage = setLeverage;
exports.placeMarketSwap = placeMarketSwap;
const node_fetch_1 = __importDefault(require("node-fetch"));
const config_1 = require("../config");
const sign_1 = require("./sign");
function isoNow() {
    return new Date().toISOString();
}
function authHeaders(method, path, body) {
    const ts = isoNow();
    const bodyStr = body ? JSON.stringify(body) : "";
    const prehash = `${ts}${method}${path}${bodyStr}`;
    const sign = (0, sign_1.okxSign)(config_1.config.okx.apiSecret, prehash);
    return {
        "OK-ACCESS-KEY": config_1.config.okx.apiKey,
        "OK-ACCESS-SIGN": sign,
        "OK-ACCESS-TIMESTAMP": ts,
        "OK-ACCESS-PASSPHRASE": config_1.config.okx.passphrase,
        "Content-Type": "application/json",
        // Demo trading must include x-simulated-trading: 1 (live uses 0/omit)
        "x-simulated-trading": config_1.config.okx.simulated ? "1" : "0"
    };
}
async function okxPublicGet(path) {
    const url = `${config_1.config.okx.baseUrl}${path}`;
    const res = await (0, node_fetch_1.default)(url, { method: "GET" });
    return (await res.json());
}
async function okxPrivate(method, path, body) {
    const url = `${config_1.config.okx.baseUrl}${path}`;
    const headers = authHeaders(method, path, body);
    const res = await (0, node_fetch_1.default)(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    return (await res.json());
}
async function getCandles(instId, bar, limit = 300) {
    const path = `/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${encodeURIComponent(bar)}&limit=${limit}`;
    return okxPublicGet(path);
}
async function getInstrument(instId, instType) {
    const path = `/api/v5/public/instruments?instType=${encodeURIComponent(instType)}&instId=${encodeURIComponent(instId)}`;
    const resp = await okxPublicGet(path);
    if (resp.code !== "0")
        throw new Error(`Instrument error: ${resp.code} ${resp.msg}`);
    const inst = resp.data?.[0];
    if (!inst)
        throw new Error(`Instrument not found for ${instId}`);
    return inst;
}
async function getUsdtBalance() {
    const resp = await okxPrivate("GET", "/api/v5/account/balance");
    if (resp.code !== "0")
        throw new Error(`Balance error: ${resp.code} ${resp.msg}`);
    const details = resp.data?.[0]?.details || [];
    const usdt = details.find((d) => d.ccy === "USDT");
    const avail = Number(usdt?.availBal ?? usdt?.cashBal ?? "0");
    return avail;
}
async function getOrder(instId, ordId) {
    const path = `/api/v5/trade/order?instId=${encodeURIComponent(instId)}&ordId=${encodeURIComponent(ordId)}`;
    const resp = await okxPrivate("GET", path);
    if (resp.code !== "0")
        throw new Error(`Get order error: ${resp.code} ${resp.msg}`);
    const o = resp.data?.[0];
    if (!o)
        throw new Error(`Order not found: ${ordId}`);
    return o;
}
async function getAlgoOrder(algoId) {
    const path = `/api/v5/trade/order-algo?algoId=${encodeURIComponent(algoId)}`;
    const resp = await okxPrivate("GET", path);
    if (resp.code !== "0")
        throw new Error(`Get algo error: ${resp.code} ${resp.msg}`);
    const a = resp.data?.[0];
    if (!a)
        throw new Error(`Algo order not found: ${algoId}`);
    // Ensure ordIdList is always array
    a.ordIdList = a.ordIdList || [];
    return a;
}
async function placeMarketBuyBase(instId, szBase) {
    const body = {
        instId,
        tdMode: "cash",
        side: "buy",
        ordType: "market",
        // IMPORTANT for SPOT market orders: tgtCcy controls unit of "sz"
        // we set base_ccy so sz is BTC amount (not USDT amount)
        tgtCcy: "base_ccy",
        sz: szBase
    };
    const resp = await okxPrivate("POST", "/api/v5/trade/order", body);
    if (resp.code !== "0")
        throw new Error(`Order error: ${resp.code} ${resp.msg}`);
    const r = resp.data?.[0];
    if (!r || r.sCode !== "0")
        throw new Error(`Order reject: ${r?.sCode} ${r?.sMsg}`);
    return r.ordId;
}
async function placeTpSlConditional(params) {
    const body = {
        instId: params.instId,
        tdMode: params.tdMode || "cash",
        side: params.side,
        ordType: "conditional",
        sz: params.szBase,
        reduceOnly: params.reduceOnly ? "true" : undefined,
        posSide: params.posSide,
        tpTriggerPx: params.tpTriggerPx,
        tpOrdPx: "-1",
        slTriggerPx: params.slTriggerPx,
        slOrdPx: "-1"
    };
    const resp = await okxPrivate("POST", "/api/v5/trade/order-algo", body);
    if (resp.code !== "0")
        throw new Error(`Algo error: ${resp.code} ${resp.msg}`);
    const r = resp.data?.[0];
    if (!r || r.sCode !== "0")
        throw new Error(`Algo reject: ${r?.sCode} ${r?.sMsg}`);
    return r.algoId;
}
async function placeMarketBuyQuote(instId, quoteSz) {
    const body = {
        instId,
        tdMode: "cash",
        side: "buy",
        ordType: "market",
        sz: quoteSz
    };
    const resp = await okxPrivate("POST", "/api/v5/trade/order", body);
    if (resp.code !== "0") {
        throw new Error(`Order error: ${resp.code} ${resp.msg}`);
    }
    const r = resp.data?.[0];
    if (!r || r.sCode !== "0") {
        throw new Error(`Order reject: ${r?.sCode} ${r?.sMsg}`);
    }
    return r.ordId;
}
async function setLeverage(params) {
    const body = {
        instId: params.instId,
        lever: params.lever,
        mgnMode: params.mgnMode,
        posSide: params.posSide
    };
    const resp = await okxPrivate("POST", "/api/v5/account/set-leverage", body);
    if (resp.code !== "0")
        throw new Error(`Set leverage error: ${resp.code} ${resp.msg}`);
    const r = resp.data?.[0];
    if (r && r.sCode && r.sCode !== "0")
        throw new Error(`Set leverage reject: ${r.sCode} ${r.sMsg}`);
}
async function placeMarketSwap(params) {
    const body = {
        instId: params.instId,
        tdMode: params.tdMode,
        side: params.side,
        ordType: "market",
        sz: params.szContracts,
        posSide: params.posSide
    };
    const resp = await okxPrivate("POST", "/api/v5/trade/order", body);
    if (resp.code !== "0")
        throw new Error(`Order error: ${resp.code} ${resp.msg}`);
    const r = resp.data?.[0];
    if (!r || r.sCode !== "0")
        throw new Error(`Order reject: ${r?.sCode} ${r?.sMsg}`);
    return r.ordId;
}
