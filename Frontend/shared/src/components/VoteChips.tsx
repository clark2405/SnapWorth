import { ArrowDown, ArrowUp, Check, type LucideIcon } from 'lucide-react-native';
import { Animated, StyleSheet, View } from 'react-native';

import { tokens, type SemanticColorName } from '../design';
import type { VoteChoice, VoteCounts } from '../types';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';
import { useCountShift, usePop } from './usePop';

export type VoteTally = VoteCounts;

const voteOrder: readonly {
  key: VoteChoice;
  label: string;
  tone: SemanticColorName;
  icon: LucideIcon;
}[] = [
  { key: 'too_high', label: 'Too High', tone: 'voteHigh', icon: ArrowUp },
  { key: 'just_right', label: 'Just Right', tone: 'voteRight', icon: Check },
  { key: 'too_low', label: 'Too Low', tone: 'voteLow', icon: ArrowDown },
];

export interface VoteChipsProps {
  readonly tally: VoteTally;
  readonly selected?: VoteChoice | null;
  /** Omit to render the tally read-only, e.g. on the voter's own post. */
  readonly onVote?: (vote: VoteChoice) => void;
}

/**
 * The three accuracy votes. Each chip carries an icon, a word, and a colour, so the outcome
 * never depends on colour alone. Tapping the selected chip again withdraws the vote. Casting a
 * vote pops the chosen chip and its icon, and every count rolls in the direction it moved.
 */
export function VoteChips({ tally, selected = null, onVote }: VoteChipsProps) {
  return (
    <View style={styles.row} accessibilityRole={onVote ? 'radiogroup' : undefined}>
      {voteOrder.map((vote) => (
        <VoteChip
          key={vote.key}
          vote={vote}
          count={tally[vote.key]}
          isSelected={vote.key === selected}
          onVote={onVote}
        />
      ))}
    </View>
  );
}

function VoteChip({
  vote,
  count,
  isSelected,
  onVote,
}: {
  readonly vote: (typeof voteOrder)[number];
  readonly count: number;
  readonly isSelected: boolean;
  readonly onVote?: (vote: VoteChoice) => void;
}) {
  const chipScale = usePop(isSelected, { enabled: isSelected });
  const iconScale = usePop(isSelected, { enabled: isSelected, peak: tokens.motion.like.scale });
  const countMotion = useCountShift(count);
  const Icon = vote.icon;

  return (
    <Animated.View style={[styles.slot, { transform: [{ scale: chipScale }] }]}>
      <PressableScale
        accessibilityRole={onVote ? 'radio' : 'text'}
        accessibilityState={{ selected: isSelected, disabled: !onVote }}
        accessibilityLabel={`${vote.label}, ${count} votes`}
        accessibilityHint={isSelected ? 'Tap again to withdraw your vote' : undefined}
        disabled={!onVote}
        onPress={() => onVote?.(vote.key)}
        containerStyle={styles.slot}
        style={[
          styles.chip,
          isSelected
            ? {
                borderColor: tokens.color.dark[vote.tone],
                backgroundColor: tokens.color.dark.surfaceRaised,
              }
            : null,
        ]}
      >
        <View style={styles.labelRow}>
          <Animated.View style={{ transform: [{ scale: iconScale }] }}>
            <Icon size={14} strokeWidth={2.25} color={tokens.color.dark[vote.tone]} />
          </Animated.View>
          <SWText variant="chip" tone={isSelected ? 'textPrimary' : 'textSecondary'}>
            {vote.label}
          </SWText>
        </View>
        <Animated.View style={countMotion}>
          <SWText variant="chip" tone="textMuted" style={styles.count}>
            {count}
          </SWText>
        </Animated.View>
      </PressableScale>
    </Animated.View>
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
    minHeight: tokens.focus.minimumTarget - tokens.spacing[1],
    borderRadius: tokens.radius.medium,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.color.dark.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[1],
    paddingVertical: tokens.spacing[2],
  },
  // Count sits under the label so all three chips keep one line of label at phone widths.
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
  },
  count: {
    fontFamily: tokens.typography.family.bodyRegular,
    fontVariant: ['tabular-nums'],
  },
});
