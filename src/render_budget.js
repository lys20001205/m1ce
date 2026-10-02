// Sustained slow frames lower GPU work; isolated loading/rotation stalls do not.
export function renderBudget(samples, current = 0) {
  const recent = samples.slice(-12).filter(ms => Number.isFinite(ms) && ms > 0 && ms < 2000);
  if (recent.length < 12) return current;
  const sorted = [...recent].sort((a, b) => a - b);
  const median = (sorted[5] + sorted[6]) / 2;
  return Math.max(current, median > 180 ? 2 : median > 100 ? 1 : 0);
}
