import fetch from "node-fetch";
import { config } from "../config";
import { okxSign } from "./sign";
import { OkxResp, Candle, AccountBalance, Instrument, OrderResult, AlgoOrderResult, OrderDetails, AlgoOrderDetails } from "./types";

function isoNow() {
  return new Date().toISOString();
}

function authHeaders(method: string, path: string, body?: unknown) {
  const ts = isoNow();
  const bodyStr = body ? JSON.stringify(body) : "";
  const prehash = `${ts}${method}${path}${bodyStr}`;
  const sign = okxSign(config.okx.apiSecret, prehash);

  return {
    "OK-ACCESS-KEY": config.okx.apiKey,
    "OK-ACCESS-SIGN": sign,
    "OK-ACCESS-TIMESTAMP": ts,
    "OK-ACCESS-PASSPHRASE": config.okx.passphrase,
    "Content-Type": "application/json",
    // Demo trading must include x-simulated-trading: 1 (live uses 0/omit)
    "x-simulated-trading": config.okx.simulated ? "1" : "0"
  };
}

async function okxPublicGet<T>(path: string): Promise<OkxResp<T>> {
  const url = `${config.okx.baseUrl}${path}`;
  const res = await fetch(url, { method: "GET" });
  return (await res.json()) as OkxResp<T>;
}

async function okxPrivate<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<OkxResp<T>> {
  const url = `${config.okx.baseUrl}${path}`;
  const headers = authHeaders(method, path, body);
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  return (await res.json()) as OkxResp<T>;
}

export async function getCandles(instId: string, bar: string, limit = 300) {
  const path = `/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${encodeURIComponent(bar)}&limit=${limit}`;
  return okxPublicGet<Candle>(path);
}

export async function getInstrument(instId: string, instType: "SPOT" | "SWAP"): Promise<Instrument> {
  const path = `/api/v5/public/instruments?instType=${encodeURIComponent(instType)}&instId=${encodeURIComponent(instId)}`;
  const resp = await okxPublicGet<Instrument>(path);
  if (resp.code !== "0") throw new Error(`Instrument error: ${resp.code} ${resp.msg}`);
  const inst = resp.data?.[0];
  if (!inst) throw new Error(`Instrument not found for ${instId}`);
  return inst;
}

export async function getUsdtBalance(): Promise<number> {
  const resp = await okxPrivate<AccountBalance>("GET", "/api/v5/account/balance");
  if (resp.code !== "0") throw new Error(`Balance error: ${resp.code} ${resp.msg}`);
  const details = resp.data?.[0]?.details || [];
  const usdt = details.find((d) => d.ccy === "USDT");
  const avail = Number(usdt?.availBal ?? usdt?.cashBal ?? "0");
  return avail;
}

export async function getOrder(instId: string, ordId: string): Promise<OrderDetails> {
  const path = `/api/v5/trade/order?instId=${encodeURIComponent(instId)}&ordId=${encodeURIComponent(ordId)}`;
  const resp = await okxPrivate<OrderDetails>("GET", path);
  if (resp.code !== "0") throw new Error(`Get order error: ${resp.code} ${resp.msg}`);
  const o = resp.data?.[0];
  if (!o) throw new Error(`Order not found: ${ordId}`);
  return o;
}

export async function getAlgoOrder(algoId: string): Promise<AlgoOrderDetails> {
  const path = `/api/v5/trade/order-algo?algoId=${encodeURIComponent(algoId)}`;
  const resp = await okxPrivate<AlgoOrderDetails>("GET", path);
  if (resp.code !== "0") throw new Error(`Get algo error: ${resp.code} ${resp.msg}`);
  const a = resp.data?.[0];
  if (!a) throw new Error(`Algo order not found: ${algoId}`);
  // Ensure ordIdList is always array
  (a as any).ordIdList = (a as any).ordIdList || [];
  return a;
}

export async function placeMarketBuyBase(instId: string, szBase: string) {
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
  const resp = await okxPrivate<OrderResult>("POST", "/api/v5/trade/order", body);
  if (resp.code !== "0") throw new Error(`Order error: ${resp.code} ${resp.msg}`);
  const r = resp.data?.[0];
  if (!r || r.sCode !== "0") throw new Error(`Order reject: ${r?.sCode} ${r?.sMsg}`);
  return r.ordId;
}

export async function placeTpSlConditional(params: {
  instId: string;
  side: "buy" | "sell";
  szBase: string;
  tpTriggerPx: string;
  slTriggerPx: string;
  reduceOnly?: boolean;
  tdMode?: "cash" | "cross" | "isolated";
  posSide?: "long" | "short";
}) {
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
  const resp = await okxPrivate<AlgoOrderResult>("POST", "/api/v5/trade/order-algo", body);
  if (resp.code !== "0") throw new Error(`Algo error: ${resp.code} ${resp.msg}`);
  const r = resp.data?.[0];
  if (!r || r.sCode !== "0") throw new Error(`Algo reject: ${r?.sCode} ${r?.sMsg}`);
  return r.algoId;
}

export async function placeMarketBuyQuote(instId: string, quoteSz: string) {
  const body = {
    instId,
    tdMode: "cash",
    side: "buy",
    ordType: "market",
    sz: quoteSz
  };
  const resp = await okxPrivate<OrderResult>("POST", "/api/v5/trade/order", body);

  if (resp.code !== "0") {
    throw new Error(`Order error: ${resp.code} ${resp.msg}`);
  }

  const r = resp.data?.[0];
  if (!r || r.sCode !== "0") {
    throw new Error(`Order reject: ${r?.sCode} ${r?.sMsg}`);
  }

  return r.ordId;
}

export async function setLeverage(params: {
  instId: string;
  lever: string;
  mgnMode: "cross" | "isolated";
  posSide?: "long" | "short";
}) {
  const body = {
    instId: params.instId,
    lever: params.lever,
    mgnMode: params.mgnMode,
    posSide: params.posSide
  };
  const resp = await okxPrivate<any>("POST", "/api/v5/account/set-leverage", body);
  if (resp.code !== "0") throw new Error(`Set leverage error: ${resp.code} ${resp.msg}`);
  const r = resp.data?.[0];
  if (r && r.sCode && r.sCode !== "0") throw new Error(`Set leverage reject: ${r.sCode} ${r.sMsg}`);
}

export async function placeMarketSwap(params: {
  instId: string;
  side: "buy" | "sell";
  szContracts: string;
  tdMode: "cross" | "isolated";
  posSide?: "long" | "short";
}) {
  const body = {
    instId: params.instId,
    tdMode: params.tdMode,
    side: params.side,
    ordType: "market",
    sz: params.szContracts,
    posSide: params.posSide
  };
  const resp = await okxPrivate<OrderResult>("POST", "/api/v5/trade/order", body);
  if (resp.code !== "0") throw new Error(`Order error: ${resp.code} ${resp.msg}`);
  const r = resp.data?.[0];
  if (!r || r.sCode !== "0") throw new Error(`Order reject: ${r?.sCode} ${r?.sMsg}`);
  return r.ordId;
}
