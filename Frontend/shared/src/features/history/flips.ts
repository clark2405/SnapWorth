import { formatPeso } from '../preview/peso';

/**
 * A flip: what someone paid for a thing, against what it's worth now. A ₱150 jacket from the
 * ukay that the AI puts at ₱2,450 is a ₱2,300 flip. The price paid is the owner's own note, so it
 * never leaves their device or account unless they choose to share it.
 */
export interface Flip {
  readonly paid: number;
  readonly worth: number;
  /** Worth minus paid: negative when it's worth less than they paid. */
  readonly gain: number;
}

/** The most anyone can say they paid: past this it's a typo, not a purchase. */
export const maximumPaid = 10_000_000;

export const flipOf = (paid: number, worth: number): Flip => ({ paid, worth, gain: worth - paid });

/**
 * What someone typed as the price they paid, in whole pesos, or null when it isn't one. Takes
 * "150", "₱1,500" and "1500.00". Nothing at all (a gift, a find) is a price too: ₱0.
 */
export function parsePaid(text: string): number | null {
  const plain = text.replace(/[₱,\s]/g, '').replace(/^php/i, '');
  if (!/^\d+(\.\d{0,2})?$/.test(plain)) return null;
  const amount = Math.round(Number(plain));
  return amount <= maximumPaid ? amount : null;
}

/** "+₱2,300", "−₱300", or "Even" when it's worth exactly what was paid. */
export function gainLabel(gain: number): string {
  if (gain === 0) return 'Even';
  return `${gain > 0 ? '+' : '−'}${formatPeso(Math.abs(gain))}`;
}

/** How many times over the price paid it's worth, when that says something: "16×". */
export function multipleLabel({ paid, worth }: Flip): string | null {
  if (paid <= 0 || worth < paid * 2) return null;
  const times = worth / paid;
  return `${times >= 10 ? Math.round(times) : Math.round(times * 10) / 10}×`;
}

export interface FlipTotals {
  /** How many items have a price paid. */
  readonly count: number;
  readonly paid: number;
  /** What those items are worth now. */
  readonly worth: number;
  readonly gain: number;
}

/** The flips across everything with a price paid, or null when none has one yet. */
export function flipTotals(
  items: readonly { readonly id: string; readonly worth: number }[],
  paidById: Readonly<Record<string, number>>,
): FlipTotals | null {
  let count = 0;
  let paid = 0;
  let worth = 0;
  for (const item of items) {
    const price = paidById[item.id];
    if (price === undefined) continue;
    count += 1;
    paid += price;
    worth += item.worth;
  }
  return count === 0 ? null : { count, paid, worth, gain: worth - paid };
}
