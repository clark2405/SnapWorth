import { ArrowUp, Menu } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import {
  BottomBar,
  hideWebFocusOutline,
  IconButton,
  NavHeader,
  Photo,
  PressableScale,
  Reveal,
  Screen,
  SWText,
} from '../../components';
import { tokens } from '../../design';
import { formatPeso, previewConversation, type PreviewMessage } from '../preview/sample-data';

export interface ConversationViewProps {
  readonly conversationId?: string;
  readonly onBack?: () => void;
  /** Report and block live in this menu (SRS 3.1.10). */
  readonly onMenu?: () => void;
  readonly onViewItem?: () => void;
  readonly onSend?: (body: string) => void;
}

export function ConversationView({ onBack, onMenu, onViewItem, onSend }: ConversationViewProps) {
  const conversation = previewConversation;
  const [messages, setMessages] = useState<readonly PreviewMessage[]>(conversation.messages);
  const [draft, setDraft] = useState('');

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    onSend?.(body);
    setMessages((current) => [
      ...current,
      { id: `local-${current.length}`, body, sentAt: 'Now', mine: true },
    ]);
    setDraft('');
  };

  return (
    <Screen
      header={
        <View>
          <NavHeader
            title="Chat"
            onBack={onBack}
            banded
            trailing={<IconButton icon={Menu} label="Report or block" onPress={onMenu} />}
          />
          <View style={styles.itemBar}>
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
            <PressableScale
              accessibilityLabel="View item"
              onPress={onViewItem}
              style={styles.viewItem}
            >
              <SWText variant="labelSmall">View item</SWText>
            </PressableScale>
          </View>
        </View>
      }
      footer={
        <BottomBar>
          <View style={styles.composerRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={send}
              placeholder="Message"
              placeholderTextColor={tokens.color.dark.textMuted}
              selectionColor={tokens.color.dark.accent}
              accessibilityLabel="Message"
              returnKeyType="send"
              style={[styles.composerInput, hideWebFocusOutline]}
            />
            <IconButton
              icon={ArrowUp}
              label="Send message"
              appearance="accent"
              size={18}
              onPress={send}
            />
          </View>
        </BottomBar>
      }
      contentStyle={styles.thread}
    >
      {messages.map((message, index) => (
        <Reveal
          key={message.id}
          index={index}
          style={[styles.message, message.mine ? styles.mine : styles.theirs]}
        >
          {message.mine ? (
            <View style={[styles.bubble, styles.bubbleMine]}>
              <SWText variant="bodySmall" tone="canvas">
                {message.body}
              </SWText>
            </View>
          ) : (
            <View style={[styles.bubble, styles.bubbleTheirs]}>
              <SWText variant="bodySmall">{message.body}</SWText>
            </View>
          )}
          <SWText variant="caption" tone="textMuted">
            {message.sentAt}
          </SWText>
        </Reveal>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  itemBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.pageGutterCompact,
    paddingVertical: tokens.spacing[2],
    borderBottomWidth: tokens.border.hairline,
    borderBottomColor: tokens.color.dark.borderSubtle,
  },
  itemThumb: {
    width: 40,
    height: 40,
  },
  itemText: {
    flex: 1,
  },
  viewItem: {
    minHeight: tokens.focus.minimumTarget - tokens.spacing[2],
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[3],
    borderRadius: tokens.radius.medium,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.color.dark.borderStrong,
  },
  thread: {
    justifyContent: 'flex-end',
    gap: tokens.spacing[4],
    paddingTop: tokens.spacing[6],
  },
  message: {
    gap: tokens.spacing[1],
    maxWidth: '78%',
  },
  mine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  theirs: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
    borderRadius: tokens.radius.large,
  },
  // Your own messages invert to paper-on-ink; the accent stays on Send, the one action here.
  bubbleMine: {
    borderBottomRightRadius: tokens.radius.small,
    backgroundColor: tokens.color.dark.textPrimary,
  },
  bubbleTheirs: {
    borderBottomLeftRadius: tokens.radius.small,
    backgroundColor: tokens.color.dark.surfaceRaised,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.layout.pageGutterCompact,
    paddingVertical: tokens.spacing[3],
  },
  composerInput: {
    flex: 1,
    minHeight: tokens.focus.minimumTarget,
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radius.medium,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.color.dark.borderStrong,
    backgroundColor: tokens.color.dark.sunken,
    color: tokens.color.dark.textPrimary,
    fontFamily: tokens.typography.family.bodyRegular,
    fontSize: tokens.typography.style.bodySmall.size,
  },
});
