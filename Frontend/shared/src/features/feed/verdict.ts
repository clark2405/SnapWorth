import type { StickerTone } from '../../components';
import type { VoteCounts } from '../../types';

/** Fewer votes than this, and the crowd hasn't spoken yet. */
const minimumVotes = 20;
/** The share one choice needs before it counts as the crowd's verdict. */
const clearMajority = 0.6;

export interface Verdict {
  readonly label: string;
  readonly tone: StickerTone;
}

/**
 * The community's verdict on a price, once there is one: enough votes, and most of them for one
 * choice. A split or quiet post has no verdict, so it gets no sticker.
 */
export function verdictFor(votes: VoteCounts): Verdict | null {
  const total = votes.too_high + votes.just_right + votes.too_low;
  if (total < minimumVotes) return null;
  if (votes.just_right / total >= clearMajority) return { label: 'Priced right', tone: 'cobalt' };
  if (votes.too_high / total >= clearMajority) return { label: 'Too high', tone: 'accent' };
  if (votes.too_low / total >= clearMajority) return { label: 'Steal', tone: 'marigold' };
  return null;
}

/**
 * Worthy's word on how the crowd has voted on an AI estimate of `estimate`: the verdict in
 * plain numbers, or how many votes it still needs. `format` writes a price.
 */
export function verdictLine(
  votes: VoteCounts,
  estimate: number,
  format: (amount: number) => string,
): string {
  const total = votes.too_high + votes.just_right + votes.too_low;
  const share = (count: number) => Math.round((count / Math.max(total, 1)) * 100);
  const price = format(estimate);
  switch (verdictFor(votes)?.label) {
    case 'Priced right':
      return `${share(votes.just_right)}% say ${price} is right. The crowd and I agree.`;
    case 'Too high':
      return `${share(votes.too_high)}% say ${price} is too much. Noted: I learn from every vote.`;
    case 'Steal':
      return `${share(votes.too_low)}% say it's worth more than ${price}. Hold out for a better offer.`;
    default:
      return total < minimumVotes
        ? `${minimumVotes - total} more ${minimumVotes - total === 1 ? 'vote' : 'votes'} and the crowd's verdict goes up on the photo.`
        : 'The crowd is split on this one. Your vote could settle it.';
  }
}
