import { ArrowUp, Menu } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
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
} from '../../components';
import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import {
  formatPeso,
  previewConversation,
  previewConversations,
  type PreviewMessage,
} from '../preview/sample-data';

export interface ConversationViewProps {
  readonly conversationId?: string;
  readonly onBack?: () => void;
  /** Report and block live in this menu (SRS 3.1.10). */
  readonly onMenu?: () => void;
  readonly onViewItem?: () => void;
  readonly onSend?: (body: string) => void;
}

const cannedReplies = [
  'Sounds good — let me know when works for you.',
  'Great, I can do that.',
  'Perfect, talk soon!',
] as const;

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
  onMenu,
  onViewItem,
  onSend,
}: ConversationViewProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const summary = useMemo(
    () =>
      previewConversations.find((entry) => entry.id === conversationId) ?? previewConversations[0],
    [conversationId],
  );
  const conversation = previewConversation;
  const [messages, setMessages] = useState<readonly PreviewMessage[]>(conversation.messages);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const counter = useRef(0);
  const grouped = useGroupedMessages(messages);

  const quickReplies = useMemo(
    () =>
      [
        { key: 'available', label: 'Still available?' },
        { key: 'agree', label: 'Sounds good' },
        {
          key: 'offer',
          label: `Offer ${formatPeso(Math.round((conversation.item.askingPrice * 0.92) / 100) * 100)}`,
        },
      ] as const,
    [conversation.item.askingPrice],
  );

  const send = useCallback(
    (body: string) => {
      const text = body.trim();
      if (!text) return;
      counter.current += 1;
      const id = `local-${counter.current}`;
      onSend?.(text);
      haptic('tap');
      setMessages((current) => [...current, { id, body: text, sentAt: 'Now', mine: true }]);
      setDraft('');
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        const reply = cannedReplies[counter.current % cannedReplies.length] ?? cannedReplies[0]!;
        setMessages((current) => [
          ...current,
          { id: `reply-${id}`, body: reply, sentAt: 'Now', mine: false },
        ]);
      }, 1200);
    },
    [onSend],
  );

  useEffect(() => {
    const timer = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages, typing]);

  return (
    <Screen
      scroll={false}
      header={
        <NavHeader
          title={`@${summary?.with.handle ?? 'seller'}`}
          onBack={onBack}
          banded
          trailing={<IconButton icon={Menu} label="Report or block" onPress={onMenu} />}
        />
      }
      footer={
        <BottomBar>
          <View style={styles.footerColumn}>
            <ChoiceChips
              options={quickReplies}
              value={null}
              onChange={(key) => {
                const option = quickReplies.find((entry) => entry.key === key);
                if (option) send(option.label);
              }}
            />
            <View style={styles.composerRow}>
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
                onPress={() => send(draft)}
              />
            </View>
          </View>
        </BottomBar>
      }
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
            accessibilityLabel={`View item, ${conversation.item.title}, asking ${formatPeso(conversation.item.askingPrice)}`}
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
                  Asking {formatPeso(conversation.item.askingPrice)}
                </SWText>
              </View>
            </Surface>
          </PressableScale>
        </Reveal>

        {grouped.map(({ message, showTime, isGroupStart }, index) => (
          <Animated.View
            key={message.id}
            entering={index === grouped.length - 1 ? FadeInDown.springify().damping(18) : undefined}
            style={[
              styles.message,
              message.mine ? styles.mine : styles.theirs,
              isGroupStart ? styles.groupStart : null,
            ]}
          >
            <View style={[styles.bubble, message.mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <SWText variant="bodySmall" tone={message.mine ? 'onInverse' : 'textPrimary'}>
                {message.body}
              </SWText>
            </View>
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
    paddingTop: tokens.spacing[2],
    paddingHorizontal: tokens.layout.pageGutterCompact,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingVertical: tokens.spacing[2],
  },
  composerInput: {
    flex: 1,
    minHeight: tokens.focus.minimumTarget,
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radius.medium,
    backgroundColor: colors.surface,
  },
}));
