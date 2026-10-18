const roundTo50 = (value: number) => Math.round(value / 50) * 50;

export interface AskingContext {
  readonly asking: number;
  readonly estimate: number;
  readonly low: number;
  readonly high: number;
}

/**
 * Worthy's word on a listing's asking price against what it's worth: to a buyer, whether to move
 * and what to offer; to the seller, whether the price will sell. `formatPeso` writes a price.
 */
export function askingLine(
  { asking, estimate, low, high }: AskingContext,
  owned: boolean,
  formatPeso: (amount: number) => string,
): string {
  const gap = formatPeso(Math.abs(estimate - asking));
  if (owned) {
    return asking > high
      ? `Buyers see this range too. At ${formatPeso(roundTo50(estimate))} it usually sells within a week.`
      : 'Priced to sell. Expect the first offers within a few days.';
  }
  if (asking < low) return `${gap} under its worth. At this price it won't last long.`;
  if (asking <= estimate) {
    return `A fair ask. Offer ${formatPeso(roundTo50(asking * 0.95))} and you'll likely meet in the middle.`;
  }
  if (asking <= high) {
    return `A touch over the estimate. Most buyers offer around ${formatPeso(roundTo50(estimate))}.`;
  }
  return `That's ${gap} over its worth. Offer near ${formatPeso(roundTo50(estimate))} and point to the range.`;
}
