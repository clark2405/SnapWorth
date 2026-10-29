import { ArrowUp, PenLine } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';

import {
  BottomBar,
  Button,
  ChoiceChips,
  Worthy,
  hideWebFocusOutline,
  NavHeader,
  Overline,
  PressableScale,
  PriceRangeBar,
  Screen,
  Sparkline,
  Surface,
  SWText,
  typeStyle,
  useToast,
} from '../../components';
import { NightRoom, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import {
  formatPeso,
  previewCompanionReplies,
  previewListingInsight,
  previewPortfolio,
  previewValuation,
} from '../preview/sample-data';
import { settleAnswer, type WorthyAnswerer, type WorthyIntent } from './worthy-replies';

type ReplyCard = 'range' | 'listing' | 'trend' | 'portfolio' | null;

interface ChatMessage {
  readonly id: string;
  readonly role: 'user' | 'worthy';
  readonly text: string;
  readonly card: ReplyCard;
  /** Answered by the model on this device, in its own words. */
  readonly onDevice?: boolean;
}

/** The app's own answer for an intent: words and the evidence card beneath them. */
function replyForIntent(intent: WorthyIntent): { text: string; card: ReplyCard } {
  switch (intent) {
    case 'collection':
      return {
        text: `Your ${previewPortfolio.itemCount} items add up to about ${formatPeso(previewPortfolio.total)}, ${previewPortfolio.changeLabel}. ${previewPortfolio.topMover.title} is your top mover.`,
        card: 'portfolio',
      };
    case 'price':
      return { text: previewCompanionReplies.fairPrice, card: 'range' };
    case 'listing':
      return { text: previewCompanionReplies.listing, card: 'listing' };
    case 'trend':
      return { text: previewCompanionReplies.trend, card: 'trend' };
    case 'chat':
      return { text: previewCompanionReplies.fallback, card: null };
  }
}

const followUps = [
  { key: 'fair', label: 'Is it a fair price?' },
  { key: 'trend', label: "What's trending?" },
  { key: 'listing', label: 'Write my listing' },
  { key: 'collection', label: 'What is my collection worth?' },
] as const;

export interface CompanionChatViewProps {
  readonly initialQuestion?: string;
  readonly onBack?: () => void;
  readonly onUseListing?: () => void;
  /**
   * Answers on the device where it can (Apple Intelligence on iOS): it works out what's being
   * asked and answers the light questions itself. Without it, Worthy goes by the question's words.
   */
  readonly answer?: WorthyAnswerer;
}

/**
 * A conversation with Worthy, set in the app's one "night room": a plum-dark palette that makes
 * talking to the AI feel like stepping into a different space. Answers arrive the way a person
 * speaks: the orb thinks, the words type themselves out, then the evidence (a range, a draft, a
 * trend) rises into place beneath.
 */
export function CompanionChatView(props: CompanionChatViewProps) {
  return (
    <NightRoom>
      <CompanionChat {...props} />
    </NightRoom>
  );
}

function CompanionChat({ initialQuestion, onBack, onUseListing, answer }: CompanionChatViewProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState('');
  const scroller = useRef<ScrollView>(null);
  const counter = useRef(0);
  const asked = useRef(false);
  // Follow the conversation as it grows (a reply types itself out, then its card rises in),
  // unless the person has scrolled up to reread something.
  const following = useRef(true);

  const ask = useCallback(
    (question: string) => {
      following.current = true;
      counter.current += 1;
      const id = `${counter.current}`;
      setMessages((current) => [
        ...current,
        { id: `u${id}`, role: 'user', text: question, card: null },
      ]);
      setThinking(true);
      const reply = (settled: ReturnType<typeof settleAnswer>) => {
        const message: ChatMessage = settled.words
          ? { id: `w${id}`, role: 'worthy', text: settled.words, card: null, onDevice: true }
          : { id: `w${id}`, role: 'worthy', ...replyForIntent(settled.intent) };
        setThinking(false);
        setMessages((current) => [...current, message]);
      };
      if (answer) {
        void answer(question)
          .catch(() => null)
          .then((found) => reply(settleAnswer(question, found)));
      } else {
        setTimeout(() => reply(settleAnswer(question, null)), 1200);
      }
    },
    [answer],
  );

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    ask(initialQuestion ?? 'What can you do?');
  }, [ask, initialQuestion]);

  const submit = () => {
    const question = draft.trim();
    // The device answers one question at a time.
    if (!question || (answer && thinking)) return;
    setDraft('');
    ask(question);
  };

  return (
    <Screen
      bleedTop
      scroll={false}
      header={<NavHeader title="Worthy" onBack={onBack} banded />}
      footer={
        <BottomBar>
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask a follow-up…"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.accent}
              returnKeyType="send"
              onSubmitEditing={submit}
              onFocus={() => {
                following.current = true;
                scroller.current?.scrollToEnd({ animated: true });
              }}
              style={[
                styles.input,
                typeStyle('bodyLarge'),
                { color: colors.textPrimary, lineHeight: undefined },
                hideWebFocusOutline,
              ]}
            />
            <PressableScale
              accessibilityLabel="Send"
              disabled={!draft.trim()}
              haptic="pop"
              onPress={submit}
              style={[styles.send, draft.trim() ? null : styles.sendIdle]}
            >
              <ArrowUp size={18} strokeWidth={2.6} color={colors.onInverse} />
            </PressableScale>
          </View>
        </BottomBar>
      }
      contentStyle={styles.noPad}
    >
      <ScrollView
        ref={scroller}
        contentContainerStyle={styles.thread}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        scrollEventThrottle={32}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          following.current =
            contentOffset.y + layoutMeasurement.height >= contentSize.height - followSlack;
        }}
        onContentSizeChange={() => {
          if (following.current) scroller.current?.scrollToEnd({ animated: true });
        }}
      >
        {/* The header already names Worthy; the intro is just Worthy itself. */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.intro}>
          <Worthy size={72} mood={thinking ? 'thinking' : 'idle'} />
        </Animated.View>

        {messages.map((message) =>
          message.role === 'user' ? (
            <Animated.View
              key={message.id}
              entering={FadeInDown.springify().damping(18)}
              layout={LinearTransition}
              style={styles.userBubble}
            >
              <SWText variant="bodyMedium" tone="onInverse">
                {message.text}
              </SWText>
            </Animated.View>
          ) : (
            <WorthyReply
              key={message.id}
              message={message}
              onUseListing={() => {
                toast.show({ title: 'Listing drafted', body: 'Review it before you publish.' });
                onUseListing?.();
              }}
            />
          ),
        )}

        {thinking ? (
          <Animated.View entering={FadeIn} style={styles.thinking}>
            <Worthy size={28} mood="thinking" />
            <SWText variant="labelMedium" tone="textMuted">
              {answer ? 'Thinking…' : 'Checking recent sales…'}
            </SWText>
          </Animated.View>
        ) : null}

        {!thinking && messages.length > 0 ? (
          <Animated.View entering={FadeIn.delay(400)} style={styles.followUps}>
            <ChoiceChips
              options={followUps}
              value={null}
              onChange={(key) => ask(followUps.find((f) => f.key === key)?.label ?? key)}
            />
          </Animated.View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function WorthyReply({
  message,
  onUseListing,
}: {
  readonly message: ChatMessage;
  readonly onUseListing: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const [typed, setTyped] = useState('');
  const done = typed.length >= message.text.length;

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      index += 3;
      setTyped(message.text.slice(0, index));
      if (index >= message.text.length) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [message.text]);

  return (
    <Animated.View entering={FadeIn.duration(200)} layout={LinearTransition} style={styles.worthy}>
      <SWText variant="bodyLarge" accessibilityLabel={message.text}>
        {typed}
      </SWText>
      {/* Only an iPhone answers on the device (see WorthyAnswerer), so the line can name it. */}
      {done && message.onDevice ? (
        <Animated.View entering={FadeIn.duration(300)}>
          <SWText variant="caption" tone="textMuted">
            Answered on your iPhone with Apple Intelligence
          </SWText>
        </Animated.View>
      ) : null}
      {done && message.card ? (
        <Animated.View entering={FadeInDown.springify().damping(18)}>
          <ReplyCardView card={message.card} onUseListing={onUseListing} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function ReplyCardView({
  card,
  onUseListing,
}: {
  readonly card: Exclude<ReplyCard, null>;
  readonly onUseListing: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  if (card === 'range') {
    return (
      <Surface padding={tokens.spacing[4]} contentStyle={styles.card}>
        <SWText variant="overline" tone="textMuted">
          Fair range
        </SWText>
        <SWText variant="priceLarge">
          {formatPeso(previewListingInsight.estimateLow)} –{' '}
          {formatPeso(previewListingInsight.estimateHigh)}
        </SWText>
        <PriceRangeBar
          low={previewListingInsight.estimateLow}
          high={previewListingInsight.estimateHigh}
          estimate={previewListingInsight.estimate}
          confidence={previewListingInsight.confidence}
          asking={3200}
          format={formatPeso}
        />
      </Surface>
    );
  }
  if (card === 'listing') {
    const draft = previewCompanionReplies.listingDraft;
    return (
      <Surface padding={tokens.spacing[4]} contentStyle={styles.card}>
        <Overline icon={PenLine} label="Draft listing" />
        <SWText variant="headingMedium">{draft.title}</SWText>
        <SWText variant="bodyMedium" tone="textSecondary">
          {draft.body}
        </SWText>
        <SWText variant="priceMedium">{formatPeso(draft.price)}</SWText>
        <Button label="Use this listing" size="medium" onPress={onUseListing} />
      </Surface>
    );
  }
  const series = card === 'portfolio' ? previewPortfolio.series : previewValuation.trend;
  return (
    <Surface padding={tokens.spacing[4]} contentStyle={styles.card}>
      <SWText variant="overline" tone="textMuted">
        {card === 'portfolio' ? 'Collection value' : 'Vintage sportswear, 12 weeks'}
      </SWText>
      <SWText variant="priceLarge">
        {card === 'portfolio' ? formatPeso(previewPortfolio.total) : previewValuation.trendChange}
      </SWText>
      <Sparkline values={series} height={64} />
    </Surface>
  );
}

/** How close to the bottom still counts as reading the latest reply. */
const followSlack = 96;

const stylesFor = themedStyles((colors) => ({
  noPad: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  thread: {
    paddingHorizontal: tokens.layout.pageGutterCompact,
    paddingTop: 120,
    paddingBottom: 140,
    gap: tokens.spacing[5],
  },
  intro: {
    alignItems: 'center',
    gap: tokens.spacing[2],
    marginBottom: tokens.spacing[4],
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    backgroundColor: colors.inverse,
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
    borderRadius: tokens.radius.large,
    borderBottomRightRadius: 6,
  },
  // Replies run the full column so their cards line up with the person's bubbles on the right.
  worthy: {
    gap: tokens.spacing[3],
  },
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  followUps: {
    marginTop: tokens.spacing[2],
  },
  card: {
    gap: tokens.spacing[3],
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingLeft: tokens.spacing[1],
  },
  input: {
    flex: 1,
    minHeight: 40,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inverse,
  },
  sendIdle: {
    opacity: 0.35,
  },
}));
