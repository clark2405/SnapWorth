import { ChevronRight, Flame, Target } from 'lucide-react-native';
import { View } from 'react-native';

import { PressableScale, Surface, SWText, Tag } from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import { dayFinished, dayScore, pointsPerRound, roundsPerDay } from './guess-game';
import { useGuessGame } from './guess-state';

/**
 * The Feed's way into Guess the worth: today's game, or today's score once it's played, and the
 * streak, so coming back each day is its own small reason to open the app.
 */
export function GuessEntry({ onOpen }: { readonly onOpen?: () => void }) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const { available, game, streak } = useGuessGame();
  const done = dayFinished(game);
  const started = game.guesses.length > 0;
  const line = done
    ? `Today: ${dayScore(game)} / ${roundsPerDay * pointsPerRound}. New items tomorrow.`
    : started
      ? `${game.guesses.length} of ${roundsPerDay} guessed. Finish today’s game.`
      : `${roundsPerDay} things, one guess each. How close can you get?`;

  // Not enough real listings to deal a day: no game to offer yet.
  if (!available) return null;

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`Guess the worth. ${line}${streak > 0 ? ` ${streak}-day streak.` : ''}`}
      onPress={onOpen}
    >
      <Surface padding={tokens.spacing[4]} contentStyle={styles.row}>
        <Target size={22} strokeWidth={1.75} color={colors.textPrimary} />
        <View style={styles.text}>
          <SWText variant="label">Guess the worth</SWText>
          <SWText variant="caption" tone="textSecondary">
            {line}
          </SWText>
        </View>
        {streak > 0 ? <Tag label={`${streak}`} icon={Flame} tone="sand" /> : null}
        <ChevronRight size={18} strokeWidth={1.75} color={colors.textMuted} />
      </Surface>
    </PressableScale>
  );
}

const stylesFor = themedStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  text: {
    flex: 1,
    gap: 2,
  },
}));
