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
