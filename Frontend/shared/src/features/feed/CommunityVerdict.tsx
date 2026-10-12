import { SWText } from '../../components';
import type { SemanticColorName } from '../../design';
import type { VoteChoice, VoteCounts } from '../../types';

export const voteLabels: Readonly<Record<VoteChoice, string>> = {
  too_high: 'Too High',
  just_right: 'Just Right',
  too_low: 'Too Low',
};

export const voteTones: Readonly<Record<VoteChoice, SemanticColorName>> = {
  too_high: 'voteHigh',
  just_right: 'voteRight',
  too_low: 'voteLow',
};

/** The leading vote and its share of all votes, or null when nobody has voted yet. */
export function leadingVote(votes: VoteCounts): { choice: VoteChoice; share: number } | null {
  const total = votes.too_high + votes.just_right + votes.too_low;
  if (total === 0) return null;

  const choice = (Object.keys(votes) as VoteChoice[]).reduce((best, next) =>
    votes[next] > votes[best] ? next : best,
  );
  return { choice, share: Math.round((votes[choice] / total) * 100) };
}

export function CommunityVerdict({ votes }: { readonly votes: VoteCounts }) {
  const verdict = leadingVote(votes);

  if (!verdict) {
    return (
      <SWText variant="labelMedium" tone="textMuted">
        No votes yet
      </SWText>
    );
  }

  return (
    <SWText variant="labelMedium" tone={voteTones[verdict.choice]}>
      Community says: {voteLabels[verdict.choice]} ({verdict.share}%)
    </SWText>
  );
}
