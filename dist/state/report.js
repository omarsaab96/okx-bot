"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReport = buildReport;
function buildReport(params) {
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
