export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD in UTC
}

export function utcHourKey(d = new Date()): string {
  return d.toISOString().slice(0, 13); // YYYY-MM-DDTHH in UTC
}
