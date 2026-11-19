/** The step offers are rounded to: pesos that suit the price, so a ₱30 item isn't offered ₱50. */
export function offerStep(askingPhp: number): number {
  if (askingPhp < 200) return 5;
  if (askingPhp < 2000) return 10;
  return 50;
}

/**
 * Quick offers as fractions of the asking price (1 is the asking price itself), rounded down to a
 * step that suits the price. Never above what's asked, never nothing, and never the same amount
 * twice: on a cheap item several fractions round to one amount, which is then offered once.
 */
export function suggestedOffers(askingPhp: number, fractions: readonly number[]): number[] {
  const step = offerStep(askingPhp);
  const amounts = fractions
    .map((fraction) =>
      fraction >= 1 ? askingPhp : Math.floor((askingPhp * fraction) / step) * step,
    )
    .filter((amount) => amount > 0 && amount <= askingPhp);
  return [...new Set(amounts)];
}
