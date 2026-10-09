import {
  ChevronDown,
  CircleHelp,
  Handshake,
  MessageCircle,
  Sparkles,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import {
  ListGroup,
  ListRow,
  NavHeader,
  PressableScale,
  Reveal,
  Screen,
  SWText,
} from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';

export interface HelpViewProps {
  readonly onBack?: () => void;
  /** Opens Worthy, the in-app guide, to ask anything the answers here don't cover. */
  readonly onAskWorthy?: () => void;
  readonly onReplayIntroduction?: () => void;
}

interface Answer {
  readonly question: string;
  readonly answer: string;
}

const topics: readonly {
  readonly title: string;
  readonly icon: LucideIcon;
  readonly answers: readonly Answer[];
}[] = [
  {
    title: 'Getting a price',
    icon: Sparkles,
    answers: [
      {
        question: 'How does SnapWorth price my item?',
        answer:
          'The AI recognises the item in your photo and compares it with recent sales of the same thing in similar condition. You get a range and the single most likely price inside it.',
      },
      {
        question: 'How sure is the estimate?',
        answer:
          'Every estimate shows its confidence. Clear, well-lit photos of a common item give high confidence; rare items or blurry photos give a wider range. Adding more angles helps.',
      },
      {
        question: 'Is the estimate what it will sell for?',
        answer:
          'No. It is a guide, not a sale price or an offer. You always set your own asking price, and the community can tell you whether they agree.',
      },
    ],
  },
  {
    title: 'Buying and selling',
    icon: Handshake,
    answers: [
      {
        question: 'How do I meet a buyer or seller safely?',
        answer:
          'Meet in a busy public place, like a mall or a café, in daylight. Check the item before you pay, and keep the conversation in SnapWorth so there is a record of it.',
      },
      {
        question: 'Can I change my asking price?',
        answer:
          'Yes. Open your listing and edit the price at any time. Anyone watching it gets a price drop alert if it goes below their alert price.',
      },
      {
        question: 'How many photos can a listing have?',
        answer:
          'Up to four: the cover and three more. Show the back, any labels or tags, and any wear, so buyers ask fewer questions.',
      },
    ],
  },
  {
    title: 'The community',
    icon: Users,
    answers: [
      {
        question: 'How do votes work?',
        answer:
          'On a post, anyone with an account can say whether the price is too high, just right or too low. The bar under it shows how the votes split, and you can change your vote by tapping it again.',
      },
      {
        question: 'How do I report a post or a comment?',
        answer:
          'Press and hold a post in the feed and choose Report, or use Report on any comment. A moderator reviews every report.',
      },
      {
        question: 'What are the community guidelines?',
        answer:
          'Be fair and be kind. Judge the price, not the person; no insults, spam or scams; only post items you have and photos you took. Posts that break these are held or removed.',
      },
    ],
  },
  {
    title: 'Your account',
    icon: UserRound,
    answers: [
      {
        question: 'Who can see my snaps?',
        answer:
          'Only you. A snap stays private in your History until you post it to the feed or list it for sale.',
      },
      {
        question: 'How do I delete my account?',
        answer:
          'Go to Profile and tap Delete account at the bottom. Your account, snaps, posts and listings are removed for good.',
      },
    ],
  },
];

/**
 * Answers to what people actually ask, grouped by what they were doing, each opening in place.
 * Below them, Worthy for anything they don't cover.
 */
export function HelpView({ onBack, onAskWorthy, onReplayIntroduction }: HelpViewProps) {
  const styles = useThemedStyles(stylesFor);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Screen
      header={<NavHeader title="Help" onBack={onBack} banded />}
      contentStyle={styles.content}
    >
      {topics.map((topic, index) => (
        <Reveal key={topic.title} index={index}>
          <ListGroup title={topic.title} icon={topic.icon}>
            {topic.answers.map((entry) => (
              <QuestionRow
                key={entry.question}
                entry={entry}
                open={open === entry.question}
                onToggle={() =>
                  setOpen((current) => (current === entry.question ? null : entry.question))
                }
              />
            ))}
          </ListGroup>
        </Reveal>
      ))}

      <Reveal index={topics.length}>
        <ListGroup title="Still stuck?" icon={CircleHelp}>
          <ListRow
            label="Ask Worthy"
            detail="Your guide in the app answers in seconds"
            icon={MessageCircle}
            onPress={onAskWorthy}
          />
          <ListRow label="Replay the introduction" icon={Sparkles} onPress={onReplayIntroduction} />
        </ListGroup>
      </Reveal>
    </Screen>
  );
}

function QuestionRow({
  entry,
  open,
  onToggle,
}: {
  readonly entry: Answer;
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const chevron = useAnimatedStyle(() => ({
    transform: [
      { rotate: withTiming(open ? '180deg' : '0deg', { duration: tokens.motion.duration.base }) },
    ],
  }));

  return (
    <Animated.View layout={LinearTransition.duration(tokens.motion.duration.base)}>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={entry.question}
        haptic="select"
        onPress={onToggle}
        style={styles.question}
      >
        <SWText variant="label" style={styles.questionText}>
          {entry.question}
        </SWText>
        <Animated.View style={chevron}>
          <ChevronDown size={18} strokeWidth={2} color={colors.textMuted} />
        </Animated.View>
      </PressableScale>
      {open ? (
        <Animated.View
          entering={FadeIn.duration(tokens.motion.duration.base)}
          exiting={FadeOut.duration(tokens.motion.duration.fast)}
        >
          <View style={styles.answer}>
            <SWText variant="bodyMedium" tone="textSecondary">
              {entry.answer}
            </SWText>
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const stylesFor = themedStyles(() => ({
  content: {
    paddingTop: tokens.spacing[4],
    gap: tokens.spacing[6],
  },
  question: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[4],
  },
  questionText: {
    flex: 1,
  },
  answer: {
    paddingHorizontal: tokens.spacing[4],
    paddingBottom: tokens.spacing[4],
  },
}));
