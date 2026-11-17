import { ArrowUp, PenLine } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  paperIn,
  paperLayout,
  BottomBar,
  Button,
  ChoiceChips,
  hideWebFocusOutline,
  NavHeader,
  Overline,
  PressableScale,
  PriceRangeBar,
  Screen,
  Sparkline,
  typeStyle,
  Surface,
  SWText,
  useToast,
  Worthy,
} from '../../components';
import { NightRoom, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import type { WorthyTurn } from '../../ports/worthy';
import { useScanHistory } from '../history/scan-history-state';
import { useMarketplace } from '../marketplace/marketplace-state';
import { formatPeso } from '../preview/sample-data';
import { useTrends } from '../trends/use-trends';
import {
  cardFor,
  contextFor,
  plainAnswer,
  subjectOf,
  type ReplyCard,
  type WorthyData,
} from './worthy-answers';
import { useWorthyCloud } from './worthy-cloud';
import { intentFor, settleAnswer, type WorthyAnswerer, type WorthyIntent } from './worthy-replies';

interface ChatMessage {
  readonly id: string;
  readonly role: 'user' | 'worthy';
  readonly text: string;
  readonly card: ReplyCard | null;
  /** Answered by the model on this device, in its own words. */
  readonly onDevice?: boolean;
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
  /** Opens the listing form for one of the person's scans, with Worthy's draft. */
  readonly onUseListing?: (scanId: string) => void;
  /** The screen Worthy was opened from (`/listing/<slug>`, `/item/<id>`): what it's about. */
  readonly about?: string;
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

function CompanionChat({
  initialQuestion,
  onBack,
  onUseListing,
  answer,
  about,
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
  // Follow the conversation as it grows (a reply types itself out, then its card rises in),
  // unless the person has scrolled up to reread something.
  const following = useRef(true);

  // What Worthy answers from: the person's own scans, the listing or item it was opened from,
  // and the Market's real trends. Never the sample data.
  const cloud = useWorthyCloud();
  const { scans } = useScanHistory();
  const { findListing } = useMarketplace();
  const { trends, detailFor } = useTrends();
  const subject = subjectOf(about);
  const data = useMemo<WorthyData>(
    () => ({
      scans,
      listing: subject?.kind === 'listing' ? findListing(subject.id) : null,
      scan:
        subject?.kind === 'item' ? (scans.find((scan) => scan.id === subject.id) ?? null) : null,
      trends,
      detailFor,
    }),
    [detailFor, findListing, scans, subject?.id, subject?.kind, trends],
  );
  const latestData = useRef(data);
  latestData.current = data;
  const turns = useRef<WorthyTurn[]>([]);

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
      const finish = (reply: Omit<ChatMessage, 'id' | 'role'>) => {
        turns.current = [
          ...turns.current,
          { role: 'user' as const, text: question },
          { role: 'worthy' as const, text: reply.text },
        ].slice(-6);
        setThinking(false);
        setMessages((current) => [...current, { id: `w${id}`, role: 'worthy', ...reply }]);
      };
      void (async () => {
        const now = latestData.current;
        let intent: WorthyIntent | null = null;
        // 1. The phone's own model (Apple Intelligence) takes the light questions.
        if (answer) {
          const found = await answer(question).catch(() => null);
          const settled = settleAnswer(question, found);
          if (settled.words) {
            finish({ text: settled.words, card: null, onDevice: true });
            return;
          }
          if (found) intent = settled.intent;
        }
        // 2. The cloud, told the person's own things, for everything else.
        if (cloud) {
          const result = await cloud.ask(question, turns.current, contextFor(now));
          if (result.ok) {
            const { intent: cloudIntent, reply, draft } = result.value;
            finish({ text: reply, card: cardFor(cloudIntent, now, draft) });
            return;
          }
        }
        // 3. No model to ask: plain words from the same data.
        const settledIntent = intent ?? intentFor(question);
        finish({ text: plainAnswer(settledIntent, now), card: cardFor(settledIntent, now) });
      })();
    },
    [answer, cloud],
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
              entering={paperIn()}
              layout={paperLayout}
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
              onUseListing={(scanId) => {
                toast.show({ title: 'Listing drafted', body: 'Review it before you publish.' });
                onUseListing?.(scanId);
              }}
            />
          ),
        )}

        {thinking ? (
          <Animated.View entering={FadeIn} style={styles.thinking}>
            <Worthy size={28} mood="thinking" />
            <SWText variant="labelMedium" tone="textMuted">
              Thinking…
            </SWText>
          </Animated.View>
        ) : null}

        {!thinking && messages.length > 0 ? (
          <Animated.View entering={FadeIn.delay(400)} style={styles.followUps}>
            <ChoiceChips
              kind="action"
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
  readonly onUseListing: (scanId: string) => void;
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
    <Animated.View entering={FadeIn.duration(200)} layout={paperLayout} style={styles.worthy}>
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
        <Animated.View entering={paperIn()}>
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
  readonly card: ReplyCard;
  readonly onUseListing: (scanId: string) => void;
}) {
  const styles = useThemedStyles(stylesFor);
  if (card.kind === 'range') {
    return (
      <Surface padding={tokens.spacing[4]} contentStyle={styles.card}>
        <SWText variant="overline" tone="textMuted" numberOfLines={1}>
          {`AI range · ${card.title}`}
        </SWText>
        <SWText variant="priceLarge">
          {formatPeso(card.low)} – {formatPeso(card.high)}
        </SWText>
        <PriceRangeBar
          low={card.low}
          high={card.high}
          estimate={card.estimate}
          asking={card.asking ?? undefined}
          format={formatPeso}
        />
      </Surface>
    );
  }
  if (card.kind === 'listing') {
    return (
      <Surface padding={tokens.spacing[4]} contentStyle={styles.card}>
        <Overline icon={PenLine} label="Draft listing" />
        <SWText variant="headingMedium">{card.title}</SWText>
        {card.body ? (
          <SWText variant="bodyMedium" tone="textSecondary">
            {card.body}
          </SWText>
        ) : null}
        <SWText variant="priceMedium">{formatPeso(card.price)}</SWText>
        <Button label="Use this listing" size="medium" onPress={() => onUseListing(card.scanId)} />
      </Surface>
    );
  }
  if (card.kind === 'trend') {
    return (
      <Surface padding={tokens.spacing[4]} contentStyle={styles.card}>
        <SWText variant="overline" tone="textMuted">
          {`${card.label} · listed most this month`}
        </SWText>
        <SWText variant="priceLarge">{`About ${formatPeso(card.typical)}`}</SWText>
        <SWText variant="caption" tone="textMuted">
          {[
            'Typical asking price',
            card.listed !== null ? `${card.listed} listed this month` : null,
            card.change ? `${card.change} on last month` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </SWText>
        {card.series.length > 1 ? <Sparkline values={card.series} height={64} /> : null}
      </Surface>
    );
  }
  return (
    <Surface padding={tokens.spacing[4]} contentStyle={styles.card}>
      <SWText variant="overline" tone="textMuted">
        Your collection
      </SWText>
      <SWText variant="priceLarge">{formatPeso(card.total)}</SWText>
      <SWText variant="caption" tone="textMuted">
        {`${card.count === 1 ? '1 item' : `${card.count} items`} at their AI estimates${card.top ? ` · worth the most: ${card.top.title}` : ''}`}
      </SWText>
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
