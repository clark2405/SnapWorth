import { ArrowDown, ArrowUp, Check, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  haptic,
  themedStyles,
  tokens,
  useTheme,
  useThemedStyles,
  type SemanticColorName,
} from '../design';
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
 * never depends on colour alone. Casting a vote floods the chip with its hue, pops the icon, and
 * rolls the count; tapping it again withdraws the vote.
 */
export function VoteChips({ tally, selected = null, onVote }: VoteChipsProps) {
  const styles = useThemedStyles(stylesFor);
  const counted: VoteTally = selected ? { ...tally, [selected]: tally[selected] + 1 } : tally;

  return (
    <View style={styles.row} accessibilityRole={onVote ? 'radiogroup' : undefined}>
      {voteOrder.map((vote) => (
        <VoteChip
          key={vote.key}
          vote={vote}
          count={counted[vote.key]}
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
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const hue = colors[vote.tone];
  const chipPop = usePop(isSelected, { enabled: isSelected, peak: 1.06 });
  const iconPop = usePop(isSelected, { enabled: isSelected, peak: 1.5 });
  const countStyle = useCountShift(count);
  const fill = useSharedValue(isSelected ? 1 : 0);
  const Icon = vote.icon;

  useEffect(() => {
    fill.value = withTiming(isSelected ? 1 : 0, { duration: 220 });
  }, [fill, isSelected]);

  const flood = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(fill.value, [0, 1], [colors.sunken, colors.surface]),
    borderColor: interpolateColor(fill.value, [0, 1], [colors.sunken, hue]),
  }));

  return (
    <Animated.View style={[styles.slot, chipPop]}>
      <PressableScale
        accessibilityRole={onVote ? 'radio' : 'text'}
        accessibilityState={{ selected: isSelected, disabled: !onVote }}
        accessibilityLabel={`${vote.label}, ${count} votes`}
        accessibilityHint={isSelected ? 'Tap again to withdraw your vote' : undefined}
        disabled={!onVote}
        haptic="none"
        onPress={() => {
          haptic(isSelected ? 'select' : 'pop');
          onVote?.(vote.key);
        }}
        containerStyle={styles.slot}
      >
        <Animated.View style={[styles.chip, flood]}>
          <View style={styles.labelRow}>
            <Animated.View style={iconPop}>
              <Icon size={14} strokeWidth={2.5} color={hue} />
            </Animated.View>
            <SWText variant="chip" tone={isSelected ? 'textPrimary' : 'textSecondary'}>
              {vote.label}
            </SWText>
          </View>
          <Animated.View style={countStyle}>
            <SWText variant="caption" tone="textMuted" style={styles.count}>
              {count}
            </SWText>
          </Animated.View>
        </Animated.View>
      </PressableScale>
    </Animated.View>
  );
}

export interface VerdictBarProps {
  readonly tally: VoteTally;
}

/**
 * The community's answer as one proportional bar, segments sized by share. Segments grow in
 * from the left on first show and re-balance on a spring whenever a vote lands.
 */
export function VerdictBar({ tally }: VerdictBarProps) {
  const styles = useThemedStyles(stylesFor);
  const total = tally.too_high + tally.just_right + tally.too_low;
  const shares = voteOrder.map((vote) => (total === 0 ? 1 / 3 : tally[vote.key] / total));
  const leader = voteOrder[shares.indexOf(Math.max(...shares))] ?? voteOrder[1]!;
  const leaderShare = Math.round(Math.max(...shares) * 100);

  return (
    <View
      style={styles.verdict}
      accessible
      accessibilityLabel={`${leaderShare}% say ${leader.label}, ${total} votes`}
    >
      <View style={styles.verdictBar}>
        {voteOrder.map((vote, index) => (
          <VerdictSegment
            key={vote.key}
            share={shares[index] ?? 0}
            tone={vote.tone}
            index={index}
          />
        ))}
      </View>
      <View style={styles.verdictLegend}>
        <SWText variant="labelSmall" tone={leader.tone}>
          {leaderShare}% {leader.label}
        </SWText>
        <SWText variant="caption" tone="textMuted">
          {total} votes
        </SWText>
      </View>
    </View>
  );
}

function VerdictSegment({
  share,
  tone,
  index,
}: {
  readonly share: number;
  readonly tone: SemanticColorName;
  readonly index: number;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const grow = useSharedValue(reduceMotion ? share : 0);

  useEffect(() => {
    grow.value = reduceMotion
      ? share
      : withSpring(share, { ...tokens.motion.spring.smooth, mass: 1 + index * 0.15 });
  }, [grow, index, reduceMotion, share]);

  const style = useAnimatedStyle(() => ({ flexGrow: grow.value, flexBasis: 0 }));
  return <Animated.View style={[{ backgroundColor: colors[tone], height: '100%' }, style]} />;
}

const stylesFor = themedStyles((colors) => ({
  row: {
    flexDirection: 'row',
    gap: tokens.spacing[2],
  },
  slot: {
    flex: 1,
  },
  chip: {
    minHeight: tokens.focus.minimumTarget + 4,
    borderRadius: tokens.radius.medium,
    borderWidth: 1.5,
    borderColor: colors.sunken,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[1],
    paddingVertical: tokens.spacing[2],
    gap: 2,
  },
  // Count sits under the label so all three chips keep one line of label at phone widths.
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
  },
  count: {
    fontVariant: ['tabular-nums'],
  },
  verdict: {
    gap: tokens.spacing[2],
  },
  verdictBar: {
    height: 6,
    borderRadius: tokens.radius.full,
    overflow: 'hidden',
    flexDirection: 'row',
    gap: 2,
    backgroundColor: colors.sunken,
  },
  verdictLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
}));
