export type RiskState = {
  dayKey: string;           // YYYY-MM-DD (UTC)
  startBalance: number;     // USDT balance at start of day
  pnlToday: number;         // USDT PnL (fees included when possible)
  wins: number;
  losses: number;
  trades: number;
  consecutiveLosses: number;
  haltedUntil?: number;     // timestamp ms (cooldown)
  dailyHalt?: boolean;      // daily max loss reached -> halt until next day
  cooldownMinutesToday: number;
  maxEquity: number;        // track drawdown
  maxDrawdown: number;
  largestWin: number;
  largestLoss: number;
};

export function canTrade(state: RiskState): { ok: boolean; reason?: string } {
  if (state.dailyHalt) return { ok: false, reason: "DAILY_HALT" };
  if (state.haltedUntil && Date.now() < state.haltedUntil) return { ok: false, reason: "COOLDOWN_ACTIVE" };
  return { ok: true };
}
