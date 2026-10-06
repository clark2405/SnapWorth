import { Archive, ArrowUp, Ban, Ellipsis, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  BottomBar,
  Button,
  ChoiceChips,
  hideWebFocusOutline,
  IconButton,
  NavHeader,
  Photo,
  PressableScale,
  Reveal,
  Screen,
  SWText,
  Surface,
  typeStyle,
  useToast,
} from '../../components';
import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import {
  formatPeso,
  previewConversation,
  previewConversations,
  type PreviewMessage,
} from '../preview/sample-data';
import { MeetupCard, OfferCard } from './ChatCards';
import { ChatActionsSheet, MeetupSheet, OfferSheet, SafetySheet } from './ChatSheets';

export interface ConversationViewProps {
  readonly conversationId?: string;
  readonly onBack?: () => void;
  readonly onViewItem?: () => void;
  readonly onSend?: (body: string) => void;
  /** A structured offer, new or countering theirs. */
  readonly onSendOffer?: (amount: number) => void;
  readonly onRespondToOffer?: (messageId: string, response: 'accept' | 'decline') => void;
  readonly onProposeMeetup?: (meetup: { readonly place: string; readonly when: string }) => void;
  readonly onConfirmMeetup?: (messageId: string) => void;
  /** Report and block live in the header menu (SRS 3.1.10). */
  readonly onReport?: (reason: string) => void;
  readonly onBlock?: (blocked: boolean) => void;
}

const cannedReplies = [
  'Sounds good — let me know when works for you.',
  'Great, I can do that.',
  'Perfect, talk soon!',
] as const;

type OpenSheet = 'actions' | 'offer' | 'meetup' | 'safety' | null;

/** Groups consecutive messages from the same sender so only the last of a run shows its time. */
function useGroupedMessages(messages: readonly PreviewMessage[]) {
  return useMemo(
    () =>
      messages.map((message, index) => {
        const next = messages[index + 1];
        const previous = messages[index - 1];
        return {
          message,
          showTime: !next || next.mine !== message.mine,
          isGroupStart: !previous || previous.mine !== message.mine,
        };
      }),
    [messages],
  );
}

export function ConversationView({
  conversationId,
  onBack,
  onViewItem,
  onSend,
  onSendOffer,
  onRespondToOffer,
  onProposeMeetup,
  onConfirmMeetup,
  onReport,
  onBlock,
}: ConversationViewProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const summary = useMemo(
    () =>
      previewConversations.find((entry) => entry.id === conversationId) ?? previewConversations[0],
    [conversationId],
  );
  const conversation = previewConversation;
  const handle = summary?.with.handle ?? 'seller';
  const askingPrice = conversation.item.askingPrice;
  const [messages, setMessages] = useState<readonly PreviewMessage[]>(conversation.messages);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [counterTo, setCounterTo] = useState<number | undefined>(undefined);
  const [blocked, setBlocked] = useState(false);
  const [reported, setReported] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const counter = useRef(0);
  const grouped = useGroupedMessages(messages);
  const closed = summary?.closed;
  const pendingTheirs = messages.some(
    (message) => !message.mine && message.offer?.status === 'pending',
  );

  const quickReplies = useMemo(
    () =>
      [
        { key: 'available', label: 'Still available?' },
        { key: 'agree', label: 'Sounds good' },
        { key: 'offer', label: 'Make an offer' },
        { key: 'pickup', label: 'Arrange pickup' },
      ] as const,
    [],
  );

  const nextId = (prefix: string) => {
    counter.current += 1;
    return `${prefix}-${counter.current}`;
  };

  /** Preview stand-in for the other person: a short pause, then an answer. */
  const reply = useCallback((answer: (current: readonly PreviewMessage[]) => PreviewMessage[]) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((current) => answer(current));
    }, 1200);
  }, []);

  const send = useCallback(
    (body: string) => {
      const text = body.trim();
      if (!text) return;
      const id = nextId('local');
      onSend?.(text);
      haptic('tap');
      setMessages((current) => [...current, { id, body: text, sentAt: 'Now', mine: true }]);
      setDraft('');
      reply((current) => [
        ...current,
        {
          id: `reply-${id}`,
          body: cannedReplies[counter.current % cannedReplies.length] ?? cannedReplies[0]!,
          sentAt: 'Now',
          mine: false,
        },
      ]);
    },
    [onSend, reply],
  );

  // A new offer replaces any still open on either side.
  const settleOpenOffers = (current: readonly PreviewMessage[]) =>
    current.map((message) =>
      message.offer?.status === 'pending'
        ? { ...message, offer: { ...message.offer, status: 'countered' as const } }
        : message,
    );

  const sendOffer = (amount: number) => {
    const id = nextId('offer');
    onSendOffer?.(amount);
    setSheet(null);
    setCounterTo(undefined);
    setMessages((current) => [
      ...settleOpenOffers(current),
      { id, body: '', sentAt: 'Now', mine: true, offer: { amount, status: 'pending' } },
    ]);
    reply((current) => [
      ...current.map((message) =>
        message.id === id && message.offer
          ? { ...message, offer: { ...message.offer, status: 'accepted' as const } }
          : message,
      ),
      { id: `reply-${id}`, body: 'Deal! When can we meet?', sentAt: 'Now', mine: false },
    ]);
  };

  const respond = (message: PreviewMessage, response: 'accept' | 'decline') => {
    onRespondToOffer?.(message.id, response);
    haptic(response === 'accept' ? 'success' : 'select');
    setMessages((current) =>
      current.map((entry) =>
        entry.id === message.id && entry.offer
          ? {
              ...entry,
              offer: { ...entry.offer, status: response === 'accept' ? 'accepted' : 'declined' },
            }
          : entry,
      ),
    );
    if (response === 'accept') {
      toast.show({
        title: 'Offer accepted',
        body: `${formatPeso(message.offer?.amount ?? 0)}. Arrange the pickup next.`,
        celebrate: true,
      });
    }
  };

  const proposeMeetup = (meetup: { readonly place: string; readonly when: string }) => {
    const id = nextId('meetup');
    onProposeMeetup?.(meetup);
    setSheet(null);
    setMessages((current) => [
      ...current,
      { id, body: '', sentAt: 'Now', mine: true, meetup: { ...meetup, status: 'proposed' } },
    ]);
    reply((current) => [
      ...current.map((message) =>
        message.id === id && message.meetup
          ? { ...message, meetup: { ...message.meetup, status: 'confirmed' as const } }
          : message,
      ),
      { id: `reply-${id}`, body: 'See you there!', sentAt: 'Now', mine: false },
    ]);
  };

  const confirmMeetup = (message: PreviewMessage) => {
    onConfirmMeetup?.(message.id);
    haptic('success');
    setMessages((current) =>
      current.map((entry) =>
        entry.id === message.id && entry.meetup
          ? { ...entry, meetup: { ...entry.meetup, status: 'confirmed' } }
          : entry,
      ),
    );
  };

  useEffect(() => {
    const timer = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages, typing]);

  const composer = closed ? (
    <View style={styles.notice} accessibilityLiveRegion="polite">
      <Archive size={16} strokeWidth={2} color={colors.textMuted} />
      <SWText variant="bodySmall" tone="textSecondary" style={styles.noticeText}>
        {closed === 'sold'
          ? 'This item has sold. The conversation is closed.'
          : 'This conversation is archived.'}
      </SWText>
    </View>
  ) : blocked ? (
    <View style={styles.notice} accessibilityLiveRegion="polite">
      <Ban size={16} strokeWidth={2} color={colors.textMuted} />
      <SWText variant="bodySmall" tone="textSecondary" style={styles.noticeText}>
        You blocked @{handle}.
      </SWText>
      <Button
        label="Unblock"
        variant="tertiary"
        size="small"
        onPress={() => {
          setBlocked(false);
          onBlock?.(false);
        }}
      />
    </View>
  ) : (
    <View style={styles.footerColumn}>
      <ChoiceChips
        options={quickReplies}
        value={null}
        scroll
        onChange={(key) => {
          if (key === 'offer') setSheet('offer');
          else if (key === 'pickup') setSheet('meetup');
          else {
            const option = quickReplies.find((entry) => entry.key === key);
            if (option) send(option.label);
          }
        }}
      />
      <View style={styles.composerRow}>
        <IconButton
          icon={Plus}
          label="Offer or pickup"
          appearance="tinted"
          size={18}
          onPress={() => setSheet('actions')}
        />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => send(draft)}
          placeholder="Message"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          accessibilityLabel="Message"
          returnKeyType="send"
          style={[
            styles.composerInput,
            typeStyle('bodyLarge'),
            { color: colors.textPrimary, lineHeight: undefined },
            hideWebFocusOutline,
          ]}
        />
        <IconButton
          icon={ArrowUp}
          label="Send message"
          appearance="accent"
          size={18}
          disabled={draft.trim().length === 0}
          onPress={() => send(draft)}
        />
      </View>
    </View>
  );

  return (
    <Screen
      scroll={false}
      header={
        <NavHeader
          title={`@${handle}`}
          onBack={onBack}
          banded
          trailing={
            <IconButton
              icon={Ellipsis}
              label="Report or block"
              onPress={() => setSheet('safety')}
            />
          }
        />
      }
      footer={<BottomBar>{composer}</BottomBar>}
      contentStyle={styles.noPad}
    >
      <ScrollView
        ref={scroller}
        contentContainerStyle={styles.thread}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <Reveal index={0}>
          <PressableScale
            accessibilityLabel={`View item, ${conversation.item.title}, asking ${formatPeso(askingPrice)}`}
            onPress={onViewItem}
            haptic="select"
            depth="surface"
          >
            <Surface tone="raised" padding={tokens.spacing[3]} contentStyle={styles.itemContent}>
              <Photo
                source={conversation.item.photo}
                label={conversation.item.title}
                radius={tokens.radius.small}
                style={styles.itemThumb}
              />
              <View style={styles.itemText}>
                <SWText variant="headingSmall" numberOfLines={1}>
                  {conversation.item.title}
                </SWText>
                <SWText variant="labelMedium" tone="textSecondary">
                  Asking {formatPeso(askingPrice)}
                </SWText>
              </View>
            </Surface>
          </PressableScale>
        </Reveal>

        {grouped.map(({ message, showTime, isGroupStart }, index) => (
          <Animated.View
            key={message.id}
            entering={index === grouped.length - 1 ? FadeInDown.springify().damping(18) : undefined}
            layout={LinearTransition.springify().damping(20)}
            style={[
              styles.message,
              message.offer || message.meetup ? styles.cardMessage : null,
              message.mine ? styles.mine : styles.theirs,
              isGroupStart ? styles.groupStart : null,
            ]}
          >
            {message.offer ? (
              <OfferCard
                offer={message.offer}
                note={message.body || undefined}
                mine={message.mine}
                askingPrice={askingPrice}
                locked={Boolean(closed) || blocked}
                onAccept={() => respond(message, 'accept')}
                onDecline={() => respond(message, 'decline')}
                onCounter={() => {
                  setCounterTo(message.offer?.amount);
                  setSheet('offer');
                }}
              />
            ) : message.meetup ? (
              <MeetupCard
                meetup={message.meetup}
                mine={message.mine}
                locked={Boolean(closed) || blocked}
                onConfirm={() => confirmMeetup(message)}
                onSuggestAnother={() => setSheet('meetup')}
              />
            ) : (
              <View style={[styles.bubble, message.mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <SWText variant="bodySmall" tone={message.mine ? 'onInverse' : 'textPrimary'}>
                  {message.body}
                </SWText>
              </View>
            )}
            {showTime ? (
              <SWText variant="caption" tone="textMuted">
                {message.sentAt}
              </SWText>
            ) : null}
          </Animated.View>
        ))}

        {typing ? (
          <Animated.View entering={FadeIn} style={[styles.message, styles.theirs]}>
            <TypingBubble />
          </Animated.View>
        ) : null}
      </ScrollView>

      <ChatActionsSheet
        visible={sheet === 'actions'}
        askingPrice={askingPrice}
        onClose={() => setSheet(null)}
        onOffer={() => setSheet('offer')}
        onMeetup={() => setSheet('meetup')}
      />
      <OfferSheet
        visible={sheet === 'offer'}
        askingPrice={askingPrice}
        initialAmount={counterTo}
        countering={pendingTheirs}
        onClose={() => {
          setSheet(null);
          setCounterTo(undefined);
        }}
        onSend={sendOffer}
      />
      <MeetupSheet
        visible={sheet === 'meetup'}
        onClose={() => setSheet(null)}
        onSend={proposeMeetup}
      />
      <SafetySheet
        visible={sheet === 'safety'}
        handle={handle}
        reported={reported}
        blocked={blocked}
        onClose={() => setSheet(null)}
        onReport={(reason) => {
          setReported(true);
          onReport?.(reason);
          toast.show({ title: 'Report sent', body: 'Our moderators will take a look.' });
        }}
        onBlock={() => {
          const next = !blocked;
          setBlocked(next);
          setSheet(null);
          onBlock?.(next);
          toast.show({ title: next ? `@${handle} blocked` : `@${handle} unblocked` });
        }}
      />
    </Screen>
  );
}

function TypingBubble() {
  const styles = useThemedStyles(stylesFor);
  return (
    <View style={[styles.bubble, styles.bubbleTheirs, styles.typingBubble]}>
      {[0, 1, 2].map((index) => (
        <TypingDot key={index} index={index} />
      ))}
    </View>
  );
}

function TypingDot({ index }: { readonly index: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const level = useSharedValue(0.35);

  useEffect(() => {
    if (reduceMotion) return;
    level.value = withDelay(
      index * 140,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }),
          withTiming(0.35, { duration: 340, easing: Easing.in(Easing.quad) }),
        ),
        -1,
      ),
    );
  }, [index, level, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: level.value,
    transform: [{ translateY: (1 - level.value) * 2 }],
  }));

  return (
    <Animated.View
      style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted }, style]}
    />
  );
}

const stylesFor = themedStyles((colors) => ({
  noPad: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  thread: {
    justifyContent: 'flex-end',
    paddingHorizontal: tokens.layout.pageGutterCompact,
    paddingTop: tokens.spacing[6],
    gap: tokens.spacing[3],
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  itemThumb: {
    width: 44,
    height: 44,
  },
  itemText: {
    flex: 1,
    gap: tokens.spacing['0.5'],
  },
  message: {
    gap: tokens.spacing[1],
    maxWidth: '78%',
  },
  // Offer and pickup cards keep one width, so a negotiation reads as a column of terms.
  cardMessage: {
    width: '78%',
  },
  groupStart: {
    marginTop: tokens.spacing[2],
  },
  mine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  theirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
    borderRadius: tokens.radius.large,
  },
  // Your own messages invert to ink-on-paper; the accent stays reserved for Send, the one
  // value-adjacent action here.
  bubbleMine: {
    borderBottomRightRadius: tokens.radius.small,
    backgroundColor: colors.inverse,
  },
  bubbleTheirs: {
    borderBottomLeftRadius: tokens.radius.small,
    backgroundColor: colors.sunken,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
    minWidth: 44,
  },
  footerColumn: {
    gap: tokens.spacing[2],
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    minHeight: tokens.focus.minimumTarget,
    paddingHorizontal: tokens.spacing[2],
  },
  noticeText: {
    flex: 1,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  composerInput: {
    flex: 1,
    minHeight: tokens.focus.minimumTarget,
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radius.medium,
    backgroundColor: colors.surface,
  },
}));
