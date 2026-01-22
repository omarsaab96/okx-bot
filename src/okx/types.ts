export type OkxResp<T> = { code: string; msg: string; data: T[] };

export type Candle = [
  string, // ts ms
  string, // o
  string, // h
  string, // l
  string, // c
  string, // vol
  string, // volCcy
  string, // volCcyQuote
  string  // confirm
];

export type BalanceDetail = {
  ccy: string;
  cashBal?: string;
  availBal?: string;
};

export type AccountBalance = {
  details: BalanceDetail[];
};

export type Instrument = {
  instId: string;
  instType: string;
  baseCcy: string;
  quoteCcy: string;
  ctVal?: string;   // contract value (e.g., 0.01 BTC for BTC-USDT-SWAP)
  ctValCcy?: string;
  minSz?: string;   // minimum order size (base)
  lotSz?: string;   // size increment (base)
  tickSz?: string;  // price tick
  state?: string;
};

export type OrderResult = { ordId: string; sCode: string; sMsg: string };

export type AlgoOrderResult = { algoId: string; sCode: string; sMsg: string };

export type OrderDetails = {
  instId: string;
  ordId: string;
  state: string;     // filled/live/etc
  side: "buy" | "sell";
  ordType: string;
  tdMode: string;
  avgPx: string;
  accFillSz: string; // base units for spot
  fee: string;
  feeCcy: string;
  cTime: string;
  fillTime?: string;
};

export type AlgoOrderDetails = {
  algoId: string;
  instId: string;
  instType: string;
  ordType: string;
  state: string; // live/effective/canceled/...
  ordIdList: string[];
  linkedOrd?: { ordId?: string };
  actualPx?: string;
  actualSz?: string;
  side: "buy" | "sell";
  tpTriggerPx?: string;
  slTriggerPx?: string;
  uTime?: string;
  cTime?: string;
};
