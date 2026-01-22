"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.utcDayKey = utcDayKey;
exports.utcHourKey = utcHourKey;
function utcDayKey(d = new Date()) {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD in UTC
}
function utcHourKey(d = new Date()) {
    return d.toISOString().slice(0, 13); // YYYY-MM-DDTHH in UTC
}
