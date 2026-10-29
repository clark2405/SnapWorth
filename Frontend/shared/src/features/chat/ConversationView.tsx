import { Archive, ArrowUp, Ban, Ellipsis, MessageSquare, Plus } from 'lucide-react-native';
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
  EmptyState,
  hideWebFocusOutline,
  IconButton,
  NavHeader,
  Photo,
  PressableScale,
  Reveal,
  Screen,
  ScreenSkeleton,
  SWText,
  Surface,
  typeStyle,
  useToast,
} from '../../components';
import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import type { ChatReportReason, Message } from '../../types/entities';
import type { AppError } from '../../types/errors';
import { formatPeso, previewPhotoByListingKey } from '../preview/sample-data';
import { MeetupCard, OfferCard } from './ChatCards';
import { ChatActionsSheet, MeetupSheet, OfferSheet, SafetySheet } from './ChatSheets';
import { chatErrorCopy, formatMessageTime } from './chat-format';
import { useConversation } from './chat-state';

export interface ConversationViewProps {
  readonly conversationId?: string;
  readonly onBack?: () => void;
  readonly onViewItem?: (listingKey: string) => void;
}

type OpenSheet = 'actions' | 'offer' | 'meetup' | 'safety' | null;

/** Groups consecutive messages from the same sender so only the last of a run shows its time. */
function useGroupedMessages(messages: readonly Message[]) {
  return useMemo(
    () =>
      messages.map((message, index) => {
        const next = messages[index + 1];
        const previous = messages[index - 1];
        return {
          message,
          showTime: !next || next.mine !== message.mine || message.delivery.status !== 'delivered',
          isGroupStart: !previous || previous.mine !== message.mine,
        };
      }),
    [messages],
  );
}

function timeLabel(message: Message): string {
  if (message.delivery.status === 'pending') return 'Sending…';
  if (message.delivery.status === 'failed') {
    return message.delivery.retryable ? 'Not sent · Tap to try again' : 'Not sent';
  }
  return formatMessageTime(message.createdAt);
}

export function ConversationView({ conversationId, onBack, onViewItem }: ConversationViewProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const chat = useConversation(conversationId);
  const { conversation, messages, typing } = chat;
  const handle = conversation?.other.handle ?? 'seller';
  const askingPrice = conversation?.listing.askingPricePhp ?? 0;
  const [draft, setDraft] = useState('');
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [counterTo, setCounterTo] = useState<number | undefined>(undefined);
  const [reported, setReported] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const grouped = useGroupedMessages(messages);
  const closed = conversation?.closed;
  const blocked = conversation?.blockedByMe ?? false;
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

  // Offline sends stay in the thread, marked to retry; anything else is worth a word.
  const complain = useCallback(
    (error: AppError) => {
      if (error.kind !== 'offline') toast.show(chatErrorCopy(error));
    },
    [toast],
  );

  const send = useCallback(
    (body: string) => {
      const text = body.trim();
      if (!text) return;
      haptic('tap');
      setDraft('');
      void chat.sendText(text).then((result) => {
        if (!result.ok) complain(result.error);
      });
    },
    [chat, complain],
  );

  const sendOffer = (amount: number) => {
    setSheet(null);
    setCounterTo(undefined);
    void chat.sendOffer(amount).then((result) => {
      if (!result.ok) complain(result.error);
    });
  };

  const respond = (message: Message, response: 'accept' | 'decline') => {
    haptic(response === 'accept' ? 'success' : 'select');
    void chat.respondToOffer(message.id, response === 'accept').then((result) => {
      if (!result.ok) {
        complain(result.error);
      } else if (response === 'accept') {
        toast.show({
          title: 'Offer accepted',
          body: `${formatPeso(message.offer?.amountPhp ?? 0)}. Arrange the pickup next.`,
          celebrate: true,
        });
      }
    });
  };

  const proposeMeetup = (meetup: { readonly place: string; readonly when: string }) => {
    setSheet(null);
    void chat.proposeMeetup(meetup).then((result) => {
      if (!result.ok) complain(result.error);
    });
  };

  const confirmMeetup = (message: Message) => {
    haptic('success');
    void chat.confirmMeetup(message.id).then((result) => {
      if (!result.ok) complain(result.error);
    });
  };

  const retry = (message: Message) => {
    if (message.delivery.status !== 'failed' || !message.delivery.retryable) return;
    void chat.retry(message.id).then((result) => {
      if (result && !result.ok) complain(result.error);
    });
  };

  const setBlocked = (next: boolean) => {
    setSheet(null);
    void chat.setBlocked(next).then((result) => {
      if (!result.ok) complain(result.error);
      else toast.show({ title: next ? `@${handle} blocked` : `@${handle} unblocked` });
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages, typing]);

  if (chat.status === 'loading' && !conversation) return <ScreenSkeleton kind="detail" />;
  if (!conversation) {
    const missing = chat.error?.kind === 'authorization';
    return (
      <Screen ambient="chat" header={<NavHeader title="Chat" onBack={onBack} banded />}>
        <EmptyState
          icon={MessageSquare}
          title={missing ? 'This conversation isn’t available' : 'Couldn’t load this chat'}
          body={
            missing
              ? 'It may have been removed, or it belongs to someone else.'
              : 'Check your connection and try again.'
          }
          actionLabel={missing ? undefined : 'Try again'}
          onAction={missing ? undefined : chat.reload}
        />
      </Screen>
    );
  }

  const listing = conversation.listing;
  const itemPhoto = listing.photoUrl
    ? { uri: listing.photoUrl }
    : previewPhotoByListingKey[listing.key];

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
      <Button label="Unblock" variant="tertiary" size="small" onPress={() => setBlocked(false)} />
    </View>
  ) : (
    <View style={styles.footerColumn}>
      <ChoiceChips
        options={quickReplies}
        value={null}
        scroll
        // The bar's corners round in close to the row, so the chips slide out of sight inside its
        // padding rather than at its edge, where they'd poke past the curve.
        bleed={0}
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
          maxLength={1000}
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
      ambient="chat"
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
            accessibilityLabel={`View item, ${listing.title}, asking ${formatPeso(askingPrice)}`}
            onPress={() => onViewItem?.(listing.key)}
            haptic="select"
            depth="surface"
          >
            <Surface tone="raised" padding={tokens.spacing[3]} contentStyle={styles.itemContent}>
              {itemPhoto ? (
                <Photo
                  source={itemPhoto}
                  label={listing.title}
                  radius={tokens.radius.small}
                  style={styles.itemThumb}
                />
              ) : null}
              <View style={styles.itemText}>
                <SWText variant="headingSmall" numberOfLines={1}>
                  {listing.title}
                </SWText>
                <SWText variant="labelMedium" tone="textSecondary">
                  Asking {formatPeso(askingPrice)}
                </SWText>
              </View>
            </Surface>
          </PressableScale>
        </Reveal>

        {messages.length === 0 ? (
          <SWText variant="bodySmall" tone="textMuted" style={styles.firstNote}>
            {conversation.iAmSeller
              ? `Say hi to @${handle}.`
              : `Ask @${handle} about the item, make an offer, or arrange a pickup.`}
          </SWText>
        ) : null}

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
              message.delivery.status === 'pending' ? styles.sending : null,
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
                  setCounterTo(message.offer?.amountPhp);
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
              message.delivery.status === 'failed' ? (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Message not sent. ${
                    message.delivery.retryable ? 'Tap to try again.' : ''
                  }`}
                  onPress={() => retry(message)}
                  haptic="select"
                >
                  <SWText variant="caption" tone="danger">
                    {timeLabel(message)}
                  </SWText>
                </PressableScale>
              ) : (
                <SWText variant="caption" tone="textMuted">
                  {timeLabel(message)}
                </SWText>
              )
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
          void chat.report(reason as ChatReportReason).then((result) => {
            if (result.ok) {
              toast.show({ title: 'Report sent', body: 'Our moderators will take a look.' });
            } else {
              setReported(false);
              complain(result.error);
            }
          });
        }}
        onBlock={() => setBlocked(!blocked)}
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
  sending: {
    opacity: 0.6,
  },
  firstNote: {
    textAlign: 'center',
    paddingHorizontal: tokens.spacing[4],
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
