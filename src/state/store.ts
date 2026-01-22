import { RiskState } from "../risk/risk";

export type Position = {
  side: "LONG" | "SHORT";
  instId: string;

  // intended
  intendedEntry: number;
  intendedSl: number;
  intendedTp: number;

  // actual from fills
  entryOrdId: string;
  entryAvgPx?: number;
  entrySz?: number;
  szUnit: "BTC" | "CONTRACTS";
  ctVal?: number;
  entryFeeUsdt?: number;

  // attached conditional TP/SL
  algoId: string;

  openedAt: number;
};

export type BotState = {
  risk: RiskState;
  position: Position | null;
};

export function initialState(dayKey: string, startBalance: number): BotState {
  return {
    risk: {
      dayKey,
      startBalance,
      pnlToday: 0,
      wins: 0,
      losses: 0,
      trades: 0,
      consecutiveLosses: 0,
      cooldownMinutesToday: 0,
      maxEquity: startBalance,
      maxDrawdown: 0,
      largestWin: 0,
      largestLoss: 0
    },
    position: null
  };
}
