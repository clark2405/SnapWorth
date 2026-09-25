import { ArrowUp } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';

import {
  BottomBar,
  Button,
  ChoiceChips,
  CompanionOrb,
  NavHeader,
  PressableScale,
  PriceRangeBar,
  Screen,
  Sparkline,
  SWText,
  Surface,
  hideWebFocusOutline,
  typeStyle,
  useToast,
} from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import {
  formatPeso,
  previewCompanionReplies,
  previewListingInsight,
  previewPortfolio,
  previewValuation,
} from '../preview/sample-data';

type ReplyCard = 'range' | 'listing' | 'trend' | 'portfolio' | null;

interface ChatMessage {
  readonly id: string;
  readonly role: 'user' | 'worthy';
  readonly text: string;
  readonly card: ReplyCard;
}

function replyFor(question: string): { text: string; card: ReplyCard } {
  if (/collection|portfolio|sell next/i.test(question)) {
    return {
      text: `Your ${previewPortfolio.itemCount} items add up to about ${formatPeso(previewPortfolio.total)}, ${previewPortfolio.changeLabel}. ${previewPortfolio.topMover.title} is your top mover.`,
      card: 'portfolio',
    };
  }
  if (/fair|offer|price\b|worth it/i.test(question))
    return { text: previewCompanionReplies.fairPrice, card: 'range' };
  if (/listing|write|describe/i.test(question))
    return { text: previewCompanionReplies.listing, card: 'listing' };
  if (/trend|heading|trending/i.test(question))
    return { text: previewCompanionReplies.trend, card: 'trend' };
  return { text: previewCompanionReplies.fallback, card: null };
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
}

/**
 * A conversation with Worthy. Answers arrive the way a person speaks: the orb thinks, the words
 * type themselves out, then the evidence (a range, a draft, a trend) rises into place beneath.
 */
export function CompanionChatView({
  initialQuestion,
  onBack,
  onUseListing,
}: CompanionChatViewProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState('');
  const scroller = useRef<ScrollView>(null);
  const counter = useRef(0);
  const asked = useRef(false);

  const ask = useCallback((question: string) => {
    counter.current += 1;
    const id = `${counter.current}`;
    setMessages((current) => [
      ...current,
      { id: `u${id}`, role: 'user', text: question, card: null },
    ]);
    setThinking(true);
    setTimeout(() => {
      const reply = replyFor(question);
      setThinking(false);
      setMessages((current) => [
        ...current,
        { id: `w${id}`, role: 'worthy', text: reply.text, card: reply.card },
      ]);
    }, 1200);
  }, []);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    ask(initialQuestion ?? 'What can you do?');
  }, [ask, initialQuestion]);

  useEffect(() => {
    const timer = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages, thinking]);

  const submit = () => {
    const question = draft.trim();
    if (!question) return;
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
      >
        <Animated.View entering={FadeIn.duration(500)} style={styles.intro}>
          <CompanionOrb size={72} mood={thinking ? 'thinking' : 'idle'} />
          <SWText variant="companion" align="center">
            Worthy
          </SWText>
          <SWText variant="caption" tone="textMuted" align="center">
            Preview answers use sample market data
          </SWText>
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
            <CompanionOrb size={28} mood="thinking" />
            <SWText variant="labelMedium" tone="textMuted">
              Checking recent sales…
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
        <SWText variant="overline" tone="accent">
          Draft listing
        </SWText>
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
  worthy: {
    gap: tokens.spacing[3],
    paddingRight: tokens.spacing[4],
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
    paddingLeft: tokens.spacing[4],
    paddingRight: tokens.spacing[2],
    paddingVertical: tokens.spacing[2],
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
