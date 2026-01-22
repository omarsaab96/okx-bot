"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lastSwingHigh = lastSwingHigh;
exports.lastSwingLow = lastSwingLow;
function lastSwingHigh(high, lookback = 30) {
    // Exclude the current candle so breakouts are possible.
    if (high.length < lookback + 6)
        return null;
    return Math.max(...high.slice(-lookback - 1, -1));
}
function lastSwingLow(low, lookback = 30) {
    // Exclude the current candle to avoid self-referential swings.
    if (low.length < lookback + 6)
        return null;
    return Math.min(...low.slice(-lookback - 1, -1));
}
