export function decimalsFromStep(step: number) {
  // Works for 0.1, 0.00001 and also 1e-8
  const s = step.toString().toLowerCase();

  if (s.includes("e-")) {
    const [, exp] = s.split("e-");
    return Number(exp);
  }

  if (!s.includes(".")) return 0;
  return s.split(".")[1].length;
}

export function floorToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.floor(value / step) * step;
}

export function roundPriceDown(px: number, tick: number): number {
  return floorToStep(px, tick);
}

export function roundSizeDown(sz: number, lot: number): number {
  return floorToStep(sz, lot);
}
