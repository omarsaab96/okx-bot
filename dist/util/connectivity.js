"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkOkxConnectivity = checkOkxConnectivity;
const config_1 = require("../config");
async function checkOkxConnectivity() {
    const url = `${config_1.config.okx.baseUrl}/api/v5/public/time`;
    try {
        const res = await fetch(url);
        if (!res.ok)
            return { ok: false, status: res.status, error: `HTTP ${res.status}`, url };
        const data = await res.json();
        return { ok: true, data, url };
    }
    catch (err) {
        return { ok: false, error: err?.message || String(err), url };
    }
}
