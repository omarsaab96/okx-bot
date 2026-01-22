"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialState = initialState;
function initialState(dayKey, startBalance) {
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
