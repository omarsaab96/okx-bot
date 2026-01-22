export function lastSwingHigh(high: number[], lookback = 30): number | null {
  // Exclude the current candle so breakouts are possible.
  if (high.length < lookback + 6) return null;
  return Math.max(...high.slice(-lookback - 1, -1));
}

export function lastSwingLow(low: number[], lookback = 30): number | null {
  // Exclude the current candle to avoid self-referential swings.
  if (low.length < lookback + 6) return null;
  return Math.min(...low.slice(-lookback - 1, -1));
}
