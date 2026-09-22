import { StyleSheet, View } from 'react-native';

import { tokens, type SemanticColorName } from '../design';
import type { VoteChoice, VoteCounts } from '../types';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';

export type VoteTally = VoteCounts;

const voteOrder: readonly { key: VoteChoice; label: string; tone: SemanticColorName }[] = [
  { key: 'too_high', label: 'Too High', tone: 'voteHigh' },
  { key: 'just_right', label: 'Just Right', tone: 'voteRight' },
  { key: 'too_low', label: 'Too Low', tone: 'voteLow' },
];

export interface VoteChipsProps {
  readonly tally: VoteTally;
  readonly selected?: VoteChoice | null;
  /** Omit to render the tally read-only, e.g. on the voter's own post. */
  readonly onVote?: (vote: VoteChoice) => void;
}

/**
 * The three accuracy votes. Each chip is labelled in words, so the outcome never depends on
 * colour alone.
 */
export function VoteChips({ tally, selected = null, onVote }: VoteChipsProps) {
  return (
    <View style={styles.row} accessibilityRole={onVote ? 'radiogroup' : undefined}>
      {voteOrder.map((vote) => {
        const isSelected = vote.key === selected;
        return (
          <PressableScale
            key={vote.key}
            accessibilityRole={onVote ? 'radio' : 'text'}
            accessibilityState={{ selected: isSelected, disabled: !onVote }}
            accessibilityLabel={`${vote.label}, ${tally[vote.key]} votes`}
            disabled={!onVote}
            onPress={() => onVote?.(vote.key)}
            containerStyle={styles.slot}
            style={[styles.chip, isSelected ? styles.selected : null]}
          >
            <SWText variant="chip" tone={vote.tone}>
              {vote.label}
            </SWText>
            <SWText variant="chip" tone="textMuted" style={styles.count}>
              {tally[vote.key]}
            </SWText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: tokens.spacing[2],
  },
  slot: {
    flex: 1,
  },
  chip: {
    minHeight: tokens.layout.chipHeight,
    borderRadius: tokens.radius.full,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.glass.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[1] + 2,
  },
  selected: {
    backgroundColor: tokens.glass.fillRaised,
    borderColor: tokens.glass.borderStrong,
  },
  count: {
    fontFamily: tokens.typography.family.bodyRegular,
  },
});
