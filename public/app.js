const engineStatus = document.getElementById("engineStatus");
const tradingStatus = document.getElementById("tradingStatus");
const marketInfo = document.getElementById("marketInfo");
const lastTick = document.getElementById("lastTick");
const okxStatus = document.getElementById("okxStatus");
const lastSignal = document.getElementById("lastSignal");
const lastReason = document.getElementById("lastReason");
const positionState = document.getElementById("positionState");
const riskSummary = document.getElementById("riskSummary");
const pnlToday = document.getElementById("pnlToday");
const maxDrawdown = document.getElementById("maxDrawdown");
const startBalance = document.getElementById("startBalance");
const currentBalance = document.getElementById("currentBalance");
const walletBalance = document.getElementById("walletBalance");
const budgetBalance = document.getElementById("budgetBalance");
const logStream = document.getElementById("logStream");
const logMeta = document.getElementById("logMeta");
const configJson = document.getElementById("configJson");
const shortNote = document.getElementById("shortNote");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function formatTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

function setPill(el, ok, text) {
  el.textContent = text;
  el.classList.remove("success", "warn");
  el.classList.add(ok ? "success" : "warn");
}

async function refreshStatus() {
  try {
    const status = await fetchJson("/api/status");
    setPill(engineStatus, status.running, status.running ? "Online" : "Offline");
    setPill(tradingStatus, status.tradingEnabled, status.tradingEnabled ? "Active" : "Paused");
    marketInfo.textContent = status.market ? `${status.market.instId} (${status.market.marketType})` : "—";
    lastTick.textContent = formatTime(status.lastTickAt);
    lastSignal.textContent = status.lastSignal?.type || "—";
    lastReason.textContent = status.lastSignal?.reason || "—";
    positionState.textContent = status.position ? status.position.side : "Flat";
    const wins = status.risk?.wins ?? 0;
    const losses = status.risk?.losses ?? 0;
    const trades = status.risk?.trades ?? 0;
    riskSummary.textContent = `${wins}/${losses} (${trades} trades)`;
    pnlToday.textContent = status.risk ? status.risk.pnlToday?.toFixed(2) : "—";
    maxDrawdown.textContent = status.risk ? status.risk.maxDrawdown?.toFixed(2) : "—";
    startBalance.textContent = status.risk ? status.risk.startBalance?.toFixed(2) : "—";
    currentBalance.textContent = status.balance ? status.balance.tradeUsdt?.toFixed(2) : "—";
    walletBalance.textContent = status.balance ? status.balance.usdt?.toFixed(2) : "—";
    budgetBalance.textContent = status.balance ? status.balance.tradeUsdt?.toFixed(2) : "—";

    if (status.market?.marketType === "SPOT") {
      shortNote.textContent = "SPOT mode: short signals are ignored. Switch to SWAP to trade both directions.";
    } else {
      shortNote.textContent = "SWAP mode: long and short signals enabled with leverage=1.";
    }
  } catch (err) {
    console.warn(err);
  }
}

async function refreshConnectivity() {
  try {
    const data = await fetchJson("/api/connectivity");
    if (data.ok) {
      setPill(okxStatus, true, "Online");
      okxStatus.title = data.url || "";
    } else {
      setPill(okxStatus, false, "Offline");
      okxStatus.title = data.error || "Unknown error";
    }
  } catch (err) {
    setPill(okxStatus, false, "Offline");
    okxStatus.title = String(err);
  }
}

async function refreshLogs() {
  try {
    const data = await fetchJson("/api/logs?limit=200");
    logStream.innerHTML = "";
    data.items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "log-line";
      const time = document.createElement("div");
      time.textContent = item.ts.split("T")[1]?.replace("Z", "") || item.ts;
      const level = document.createElement("div");
      level.className = `level ${item.level}`;
      level.textContent = item.level;
      const msg = document.createElement("div");
      msg.textContent = item.msg || JSON.stringify(item.data || {});
      row.appendChild(time);
      row.appendChild(level);
      row.appendChild(msg);
      logStream.appendChild(row);
    });
    logStream.scrollTop = logStream.scrollHeight;
    logMeta.textContent = `${data.items.length} lines`;
  } catch (err) {
    console.warn(err);
  }
}

async function loadConfig() {
  try {
    const cfg = await fetchJson("/api/config");
    configJson.textContent = JSON.stringify(cfg, null, 2);
  } catch (err) {
    configJson.textContent = "Failed to load config.";
  }
}

startBtn.addEventListener("click", async () => {
  await fetchJson("/api/start", { method: "POST" });
  refreshStatus();
});

stopBtn.addEventListener("click", async () => {
  await fetchJson("/api/stop", { method: "POST" });
  refreshStatus();
});

loadConfig();
refreshStatus();
refreshLogs();
refreshConnectivity();
setInterval(refreshStatus, 2000);
setInterval(refreshLogs, 3000);
setInterval(refreshConnectivity, 5000);
