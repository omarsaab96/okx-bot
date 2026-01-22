export type DailyReport = {
  dateUtc: string;
  startBalance: number;
  endBalance: number;
  pnl: number;
  pnlPct: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  maxDrawdown: number;
  largestWin: number;
  largestLoss: number;
  cooldownMinutes: number;
};

export function buildReport(params: {
  dateUtc: string;
  startBalance: number;
  endBalance: number;
  trades: number;
  wins: number;
  losses: number;
  maxDrawdown: number;
  largestWin: number;
  largestLoss: number;
  cooldownMinutes: number;
}): DailyReport {
  const pnl = params.endBalance - params.startBalance;
  const pnlPct = params.startBalance > 0 ? pnl / params.startBalance : 0;
  const winRate = params.trades > 0 ? params.wins / params.trades : 0;

  return {
    dateUtc: params.dateUtc,
    startBalance: params.startBalance,
    endBalance: params.endBalance,
    pnl,
    pnlPct,
    trades: params.trades,
    wins: params.wins,
    losses: params.losses,
    winRate,
    maxDrawdown: params.maxDrawdown,
    largestWin: params.largestWin,
    largestLoss: params.largestLoss,
    cooldownMinutes: params.cooldownMinutes
  };
}
