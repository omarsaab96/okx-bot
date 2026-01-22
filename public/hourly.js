const reportList = document.getElementById("reportList");
const updatedAt = document.getElementById("updatedAt");
const entryCount = document.getElementById("entryCount");

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function fmt(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function formatHourKey(hourKey) {
  if (!hourKey || typeof hourKey !== "string") return "—";
  const match = hourKey.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/);
  if (!match) return hourKey;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const utc = new Date(Date.UTC(year, month, day, hour, 0, 0));
  const local = new Date(utc.getTime());
  return `${utc.toISOString().slice(0, 16).replace("T", " ")} UTC / ${local.toLocaleString()}`;
}

function render(items) {
  reportList.innerHTML = "";
  items.forEach((item) => {
    const data = item.data || {};
    const row = document.createElement("div");
    row.className = "report-item";
    const title = document.createElement("div");
    title.className = "report-title";
    title.textContent = formatHourKey(data.hourUtc) || item.file;
    const meta = document.createElement("div");
    meta.className = "report-meta";
    meta.innerHTML = `
      <span>Start: ${fmt(data.startBalance)}</span>
      <span>End: ${fmt(data.endBalance)}</span>
      <span>PnL: ${fmt(data.pnl)}</span>
      <span>Trades: ${data.trades ?? "—"}</span>
      <span>Wins: ${data.wins ?? "—"}</span>
      <span>Losses: ${data.losses ?? "—"}</span>
    `;
    row.appendChild(title);
    row.appendChild(meta);
    reportList.appendChild(row);
  });
}

async function loadReports() {
  try {
    const data = await fetchJson("/api/hourly?limit=72");
    const items = (data.items || []).slice().reverse();
    render(items);
    updatedAt.textContent = new Date().toLocaleTimeString();
    entryCount.textContent = String(items.length);
  } catch (err) {
    reportList.textContent = "Failed to load hourly reports.";
  }
}

loadReports();
setInterval(loadReports, 10000);
