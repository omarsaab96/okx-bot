"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decimalsFromStep = decimalsFromStep;
exports.floorToStep = floorToStep;
exports.roundPriceDown = roundPriceDown;
exports.roundSizeDown = roundSizeDown;
function decimalsFromStep(step) {
    // Works for 0.1, 0.00001 and also 1e-8
    const s = step.toString().toLowerCase();
    if (s.includes("e-")) {
        const [, exp] = s.split("e-");
        return Number(exp);
    }
    if (!s.includes("."))
        return 0;
    return s.split(".")[1].length;
}
function floorToStep(value, step) {
    if (step <= 0)
        return value;
    return Math.floor(value / step) * step;
}
function roundPriceDown(px, tick) {
    return floorToStep(px, tick);
}
function roundSizeDown(sz, lot) {
    return floorToStep(sz, lot);
}
