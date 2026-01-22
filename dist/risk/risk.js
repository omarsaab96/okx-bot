"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canTrade = canTrade;
function canTrade(state) {
    if (state.dailyHalt)
        return { ok: false, reason: "DAILY_HALT" };
    if (state.haltedUntil && Date.now() < state.haltedUntil)
        return { ok: false, reason: "COOLDOWN_ACTIVE" };
    return { ok: true };
}
