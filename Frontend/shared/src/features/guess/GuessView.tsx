import { Award, ChevronRight, Flame, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Share, View } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  Button,
  Divider,
  NavHeader,
  paperIn,
  Photo,
  PressableScale,
  Reveal,
  Screen,
  Sign,
  Surface,
  SWText,
  Tag,
  TextField,
  useToast,
} from '../../components';
import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import type { VoteChoice } from '../../types';
import { formatPeso } from '../preview/peso';
import {
  dayFinished,
  dayScore,
  guessAmount,
  offByLabel,
  pointsPerRound,
  roundsPerDay,
  sharpEyeScore,
  shareText,
  type DayGame,
  type Guess,
  type GuessItem,
} from './guess-game';
import { useGuessGame } from './guess-state';

export interface GuessViewProps {
  readonly onBack?: () => void;
  /** Opens a listing from the day's summary. */
  readonly onOpenListing?: (listingId: string) => void;
  /** For tests: the clock the day is read from. */
  readonly now?: () => Date;
}

const verdictWords: Record<VoteChoice, string> = {
  too_high: 'too high',
  just_right: 'just right',
  too_low: 'too low',
};

/**
 * Guess the worth: five of the Market's listings a day, the same five for everyone. Guess what
 * each is worth, then see the AI's estimate and what voters think of the asking price. It
 * teaches what things go for, which makes everyone's votes better. No account needed.
 */
export function GuessView({ onBack, onOpenListing, now }: GuessViewProps) {
  const styles = useThemedStyles(stylesFor);
  const { status, items, game, guess, streak, sharpEyes } = useGuessGame(now);
  // Which of the day's things is on screen. It starts at the first one not yet guessed, so
  // leaving mid-game picks up where it was.
  const [step, setStep] = useState<number | null>(null);
  useEffect(() => {
    if (status === 'ready' && step === null) setStep(game.guesses.length);
  }, [game.guesses.length, status, step]);

  const showing = step ?? 0;
  const summary = status === 'ready' && step !== null && showing >= roundsPerDay;
  const item = items[showing];

  return (
    <Screen
      ambient="feed"
      header={<NavHeader title="Guess the worth" onBack={onBack} banded />}
      contentStyle={styles.content}
    >
      {status === 'loading' || step === null ? null : summary ? (
        <DaySummary
          game={game}
          items={items}
          streak={streak}
          sharpEyes={sharpEyes}
          onOpenListing={onOpenListing}
        />
      ) : item ? (
        <Round
          key={item.id}
          index={showing}
          item={item}
          guessed={game.guesses[showing]}
          onGuess={(amount) => {
            haptic('pop');
            guess(amount);
          }}
          onNext={() => setStep(showing + 1)}
        />
      ) : null}
    </Screen>
  );
}

/** Where a day's game stands: one dot per thing, filled once it's guessed. */
function Progress({ index }: { readonly index: number }) {
  const styles = useThemedStyles(stylesFor);
  return (
    <View
      style={styles.progress}
      accessible
      accessibilityLabel={`Item ${index + 1} of ${roundsPerDay}`}
    >
      {Array.from({ length: roundsPerDay }, (_, dot) => (
        <View
          key={dot}
          style={[styles.dot, dot < index ? styles.dotDone : dot === index ? styles.dotNow : null]}
        />
      ))}
      <SWText variant="caption" tone="textMuted" style={styles.progressText}>
        {`${index + 1} of ${roundsPerDay}`}
      </SWText>
    </View>
  );
}

/** One thing to guess, and once guessed, how close it was. */
function Round({
  index,
  item,
  guessed,
  onGuess,
  onNext,
}: {
  readonly index: number;
  readonly item: GuessItem;
  readonly guessed: Guess | undefined;
  readonly onGuess: (amount: number) => void;
  readonly onNext: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const [text, setText] = useState('');
  const amount = guessAmount(text);
  const last = index === roundsPerDay - 1;

  return (
    <Reveal index={0} style={styles.round}>
      <Progress index={index} />
      <Photo source={item.photo} label={item.photoLabel} aspectRatio={4 / 3} />
      <SWText variant="headingMedium" accessibilityRole="header">
        {item.title}
      </SWText>

      {guessed ? (
        <Animated.View entering={paperIn(0, 8)}>
          <Surface padding={tokens.spacing[4]} contentStyle={styles.answer}>
            <View style={styles.answerTop}>
              <View style={styles.answerWorth}>
                <SWText variant="overline" tone="textMuted">
                  SnapWorth says
                </SWText>
                <SWText variant="priceLarge">{formatPeso(item.worth)}</SWText>
                <SWText variant="caption" tone="textSecondary">
                  {`Range ${formatPeso(item.low)}–${formatPeso(item.high)}`}
                </SWText>
              </View>
              <Tag
                label={`+${guessed.points}`}
                tone={guessed.points >= 90 ? 'mint' : guessed.points >= 60 ? 'sand' : 'warn'}
              />
            </View>
            <Divider />
            <SWText variant="bodyMedium">
              {`You said ${formatPeso(guessed.amount)}: ${offByLabel(guessed.amount, item.worth)}.`}
            </SWText>
            <SWText variant="bodyMedium" tone="textSecondary">
              {`It’s listed at ${formatPeso(item.askingPrice)}, and ${item.verdictShare}% of voters say that’s ${verdictWords[item.verdict]}.`}
            </SWText>
          </Surface>
          <Button
            label={last ? 'See your score' : 'Next item'}
            onPress={onNext}
            containerStyle={styles.next}
          />
        </Animated.View>
      ) : (
        <View style={styles.ask}>
          <TextField
            size="large"
            prefix="₱"
            value={text}
            onChangeText={setText}
            placeholder="Your guess"
            keyboardType="number-pad"
            inputMode="numeric"
            returnKeyType="done"
            onSubmitEditing={() => (amount > 0 ? onGuess(amount) : undefined)}
            accessibilityLabel={`Your guess for ${item.title}, in pesos`}
          />
          <Button label="Guess" disabled={amount <= 0} onPress={() => onGuess(amount)} />
        </View>
      )}
    </Reveal>
  );
}

/** Shares the day's score: the phone's share sheet, or the clipboard where there's none. */
async function shareScore(game: DayGame): Promise<'shared' | 'copied' | 'failed'> {
  const message = shareText(game);
  try {
    if (Platform.OS === 'web') {
      const browser = globalThis.navigator as Navigator | undefined;
      if (browser?.share) {
        await browser.share({ text: message });
        return 'shared';
      }
      await browser?.clipboard.writeText(message);
      return 'copied';
    }
    await Share.share({ message });
    return 'shared';
  } catch {
    return 'failed';
  }
}

/** The day, finished: the score, each guess against the worth, the streak and the badge. */
function DaySummary({
  game,
  items,
  streak,
  sharpEyes,
  onOpenListing,
}: {
  readonly game: DayGame;
  readonly items: readonly GuessItem[];
  readonly streak: number;
  readonly sharpEyes: number;
  readonly onOpenListing?: (listingId: string) => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const toast = useToast();
  const score = dayScore(game);
  const sharpEye = dayFinished(game) && score >= sharpEyeScore;

  return (
    <>
      <Reveal index={0}>
        <Surface padding={tokens.spacing[5]} contentStyle={styles.score}>
          <SWText variant="overline" tone="textMuted">
            Today’s score
          </SWText>
          <SWText
            variant="priceHero"
            accessibilityLabel={`${score} out of ${roundsPerDay * pointsPerRound}`}
          >
            {`${score}`}
            <SWText variant="headingMedium" tone="textMuted">
              {` / ${roundsPerDay * pointsPerRound}`}
            </SWText>
          </SWText>
          <View style={styles.tags}>
            {sharpEye ? <Tag label="Sharp eye" icon={Award} tone="mint" /> : null}
            {streak > 0 ? (
              <Tag
                label={streak === 1 ? '1-day streak' : `${streak}-day streak`}
                icon={Flame}
                tone="sand"
              />
            ) : null}
          </View>
          <SWText variant="caption" tone="textSecondary">
            {sharpEye
              ? sharpEyes > 1
                ? `Sharp eye ${sharpEyes} times now. New items tomorrow.`
                : 'Sharp eye: you know what things go for. New items tomorrow.'
              : `Score ${sharpEyeScore} or more for the Sharp eye badge. New items tomorrow.`}
          </SWText>
          <Button
            label="Share your score"
            icon={Share2}
            variant="secondary"
            onPress={async () => {
              const shared = await shareScore(game);
              if (shared === 'copied') toast.show({ title: 'Score copied' });
              if (shared === 'failed')
                toast.show({ title: 'Couldn’t share it', body: 'Try again.' });
            }}
          />
        </Surface>
      </Reveal>

      <Reveal index={1} style={styles.rows}>
        <Sign label="How you did" />
        {game.guesses.map((guessed, index) => {
          const item = items.find((entry) => entry.id === guessed.itemId);
          if (!item) return null;
          return (
            <View key={guessed.itemId}>
              {index > 0 ? <Divider /> : null}
              {/* The whole row opens the listing, to see it for real. */}
              <PressableScale
                accessibilityRole={onOpenListing ? 'link' : undefined}
                accessibilityLabel={`${item.title}. You guessed ${formatPeso(guessed.amount)}, it’s worth ${formatPeso(item.worth)}. ${guessed.points} points.`}
                disabled={!onOpenListing}
                onPress={() => onOpenListing?.(item.id)}
                style={styles.row}
              >
                <Photo source={item.photo} label={item.photoLabel} style={styles.thumb} />
                <View style={styles.rowText}>
                  <SWText variant="label" numberOfLines={1}>
                    {item.title}
                  </SWText>
                  <SWText variant="caption" tone="textSecondary">
                    {`You ${formatPeso(guessed.amount)} · Worth ${formatPeso(item.worth)}`}
                  </SWText>
                </View>
                <Tag
                  label={`+${guessed.points}`}
                  tone={guessed.points >= 90 ? 'mint' : guessed.points >= 60 ? 'sand' : 'warn'}
                />
                {onOpenListing ? (
                  <ChevronRight size={18} strokeWidth={1.75} color={colors.textMuted} />
                ) : null}
              </PressableScale>
            </View>
          );
        })}
      </Reveal>
    </>
  );
}

const stylesFor = themedStyles((colors) => ({
  content: {
    gap: tokens.spacing[6],
  },
  round: {
    gap: tokens.spacing[4],
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  progressText: {
    marginLeft: tokens.spacing[2],
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.borderSubtle,
  },
  dotDone: {
    backgroundColor: colors.accent,
  },
  dotNow: {
    backgroundColor: colors.textPrimary,
  },
  ask: {
    gap: tokens.spacing[3],
  },
  answer: {
    gap: tokens.spacing[3],
  },
  answerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing[3],
  },
  answerWorth: {
    flex: 1,
    gap: 2,
  },
  next: {
    marginTop: tokens.spacing[4],
  },
  score: {
    gap: tokens.spacing[3],
    alignItems: 'flex-start',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[2],
  },
  rows: {
    gap: tokens.spacing[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
  },
  thumb: {
    width: 56,
    height: 56,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
}));
