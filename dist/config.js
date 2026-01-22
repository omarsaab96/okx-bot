"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ override: true });
function must(name) {
    const v = process.env[name];
    if (!v)
        throw new Error(`Missing env var: ${name}`);
    return v;
}
exports.config = {
    okx: {
        baseUrl: process.env.OKX_BASE_URL || "https://www.okx.com",
        apiKey: must("OKX_API_KEY"),
        apiSecret: must("OKX_API_SECRET"),
        passphrase: must("OKX_API_PASSPHRASE"),
        simulated: (process.env.OKX_SIMULATED || "1") === "1"
    },
    bot: {
        instId: process.env.BOT_INST_ID || "BTC-USDT",
        mode: process.env.BOT_MODE || "DEMO_SPOT",
        marketType: (process.env.BOT_MARKET_TYPE || "SPOT"),
        mgnMode: (process.env.MGN_MODE || "cross"),
        positionMode: (process.env.POSITION_MODE || "net"),
        leverage: Number(process.env.LEVERAGE || "1"),
        autoStart: (process.env.BOT_AUTO_START || "1") === "1",
        pollSeconds: Number(process.env.POLL_SECONDS || "30")
    },
    dashboard: {
        port: Number(process.env.DASHBOARD_PORT || "8787")
    },
    risk: {
        riskPerTrade: Number(process.env.RISK_PER_TRADE || "0.005"),
        maxDailyLoss: Number(process.env.MAX_DAILY_LOSS || "0.01"),
        lossStreak: Number(process.env.LOSS_STREAK || "3"),
        lossCooldownMinutes: Number(process.env.LOSS_COOLDOWN_MINUTES || "120"),
        minUsdtBalance: Number(process.env.MIN_USDT_BALANCE || "10"),
        maxPositionPct: Number(process.env.MAX_POSITION_PCT || "0.01"),
        tradeBudgetUsdt: Number(process.env.TRADE_BUDGET_USDT || "0")
    },
    strat: {
        trendEma: Number(process.env.TREND_EMA || "200"),
        trendMinPct: Number(process.env.TREND_MIN_PCT || "0.0005"),
        atrLen: Number(process.env.ATR_LEN || "14"),
        slAtrMult: Number(process.env.SL_ATR_MULT || "1.5"),
        tpRMultBreakout: Number(process.env.TP_R_MULT_BREAKOUT || process.env.TP_R_MULT || "2.0"),
        tpRMultPullback: Number(process.env.TP_R_MULT_PULLBACK || process.env.TP_R_MULT || "1.6"),
        tpRMultMomentum: Number(process.env.TP_R_MULT_MOMENTUM || process.env.TP_R_MULT || "1.4"),
        tpRMultMeanRev: Number(process.env.TP_R_MULT_MEAN_REV || process.env.TP_R_MULT || "1.0"),
        pullbackEmaLen: Number(process.env.PULLBACK_EMA_LEN || "20"),
        momentumEmaFast: Number(process.env.MOMENTUM_EMA_FAST || "9"),
        momentumEmaSlow: Number(process.env.MOMENTUM_EMA_SLOW || "21"),
        rsiLen: Number(process.env.RSI_LEN || "14"),
        rsiOverbought: Number(process.env.RSI_OVERBOUGHT || "70"),
        rsiOversold: Number(process.env.RSI_OVERSOLD || "30"),
        bbLen: Number(process.env.BB_LEN || "20"),
        bbStd: Number(process.env.BB_STD || "2"),
        entryTf: process.env.ENTRY_TIMEFRAME || "15m",
        trendTf: process.env.TREND_TIMEFRAME || "1H"
    }
};
