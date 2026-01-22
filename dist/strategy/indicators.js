"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ema = ema;
exports.atr = atr;
exports.sma = sma;
exports.stdev = stdev;
exports.rsi = rsi;
function ema(values, length) {
    if (values.length < length)
        return [];
    const k = 2 / (length + 1);
    const out = [];
    let prev = values.slice(0, length).reduce((a, b) => a + b, 0) / length;
    out.push(prev);
    for (let i = length; i < values.length; i++) {
        prev = values[i] * k + prev * (1 - k);
        out.push(prev);
    }
    return out;
}
function atr(high, low, close, length) {
    if (close.length < length + 1)
        return [];
    const tr = [];
    for (let i = 1; i < close.length; i++) {
        const hl = high[i] - low[i];
        const hc = Math.abs(high[i] - close[i - 1]);
        const lc = Math.abs(low[i] - close[i - 1]);
        tr.push(Math.max(hl, hc, lc));
    }
    const out = [];
    let prev = tr.slice(0, length).reduce((a, b) => a + b, 0) / length;
    out.push(prev);
    for (let i = length; i < tr.length; i++) {
        prev = (prev * (length - 1) + tr[i]) / length;
        out.push(prev);
    }
    return out;
}
function sma(values, length) {
    if (values.length < length)
        return [];
    const out = [];
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
        sum += values[i];
        if (i >= length)
            sum -= values[i - length];
        if (i >= length - 1)
            out.push(sum / length);
    }
    return out;
}
function stdev(values, length) {
    if (values.length < length)
        return [];
    const out = [];
    for (let i = length - 1; i < values.length; i++) {
        const window = values.slice(i - length + 1, i + 1);
        const mean = window.reduce((a, b) => a + b, 0) / length;
        const variance = window.reduce((a, b) => a + (b - mean) * (b - mean), 0) / length;
        out.push(Math.sqrt(variance));
    }
    return out;
}
function rsi(values, length) {
    if (values.length < length + 1)
        return [];
    const out = [];
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= length; i++) {
        const diff = values[i] - values[i - 1];
        if (diff >= 0)
            gains += diff;
        else
            losses -= diff;
    }
    let avgGain = gains / length;
    let avgLoss = losses / length;
    let rs = avgLoss === 0 ? 0 : avgGain / avgLoss;
    out.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
    for (let i = length + 1; i < values.length; i++) {
        const diff = values[i] - values[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        avgGain = (avgGain * (length - 1) + gain) / length;
        avgLoss = (avgLoss * (length - 1) + loss) / length;
        rs = avgLoss === 0 ? 0 : avgGain / avgLoss;
        out.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
    }
    return out;
}
