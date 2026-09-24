import { MessageSquare } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  Divider,
  EmptyState,
  LargeTitle,
  Photo,
  PressableScale,
  Reveal,
  Screen,
  SWText,
} from '../../components';
import { tokens } from '../../design';
import { previewConversations, type PreviewConversationSummary } from '../preview/sample-data';
import { ProfileButton } from '../profile/ProfileButton';

export interface ConversationListViewProps {
  readonly onOpenConversation?: (conversationId: string) => void;
  readonly onOpenProfile?: () => void;
  readonly onBrowseMarket?: () => void;
}

export function ConversationListView({
  onOpenConversation,
  onOpenProfile,
  onBrowseMarket,
}: ConversationListViewProps) {
  const conversations = previewConversations;
  const unread = conversations.reduce((total, conversation) => total + conversation.unread, 0);

  return (
    <Screen clearTabBar>
      <LargeTitle
        title="Chat"
        subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
        trailing={<ProfileButton onPress={onOpenProfile} />}
      />
      {conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          body="Message a seller from any listing and the conversation appears here."
          actionLabel="Browse the market"
          onAction={onBrowseMarket}
        />
      ) : (
        <View>
          {conversations.map((conversation, index) => (
            <Reveal key={conversation.id} index={index}>
              {index > 0 ? <Divider style={styles.divider} /> : null}
              <ConversationRow
                conversation={conversation}
                onPress={() => onOpenConversation?.(conversation.id)}
              />
            </Reveal>
          ))}
        </View>
      )}
    </Screen>
  );
}

function ConversationRow({
  conversation,
  onPress,
}: {
  conversation: PreviewConversationSummary;
  onPress: () => void;
}) {
  const unread = conversation.unread > 0;
  const preview = `${conversation.lastFromMe ? 'You: ' : ''}${conversation.lastMessage}`;

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`Conversation with ${conversation.with.handle} about ${conversation.itemTitle}. ${
        unread ? `${conversation.unread} unread. ` : ''
      }Last message: ${preview}, ${conversation.sentAt}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.media}>
        <Photo
          source={conversation.itemPhoto}
          label={conversation.itemTitle}
          radius={tokens.radius.medium}
          style={styles.thumb}
        />
        <View style={styles.avatar}>
          <Avatar source={conversation.with.avatar} name={conversation.with.handle} size={24} />
        </View>
      </View>
      <View style={styles.text}>
        <View style={styles.topLine}>
          <SWText variant={unread ? 'labelSmall' : 'labelMedium'} style={styles.handle}>
            @{conversation.with.handle}
          </SWText>
          <SWText variant="caption" tone={unread ? 'textPrimary' : 'textMuted'}>
            {conversation.sentAt}
          </SWText>
        </View>
        <SWText variant="caption" tone="textMuted" numberOfLines={1}>
          {conversation.itemTitle}
        </SWText>
        <View style={styles.bottomLine}>
          <SWText
            variant="bodyCompact"
            tone={unread ? 'textPrimary' : 'textSecondary'}
            numberOfLines={1}
            style={styles.preview}
          >
            {preview}
          </SWText>
          {unread ? (
            <View style={styles.badge}>
              <SWText variant="tag" tone="onAccent">
                {String(conversation.unread)}
              </SWText>
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  divider: {
    marginLeft: tokens.layout.thumbnail - tokens.spacing[2] + tokens.spacing[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[4],
    paddingVertical: tokens.spacing[4],
    borderRadius: tokens.radius.medium,
  },
  pressed: {
    backgroundColor: tokens.color.dark.surface,
  },
  media: {
    width: tokens.layout.thumbnail - tokens.spacing[2],
    height: tokens.layout.thumbnail - tokens.spacing[2],
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  avatar: {
    position: 'absolute',
    right: -tokens.spacing[1],
    bottom: -tokens.spacing[1],
    borderRadius: tokens.radius.full,
    borderWidth: tokens.border.focus,
    borderColor: tokens.color.dark.canvas,
  },
  text: {
    flex: 1,
    gap: tokens.spacing['0.5'],
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  handle: {
    flex: 1,
  },
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  preview: {
    flex: 1,
  },
  // Unread count is informational, so it stays small; the lime marks "needs you".
  badge: {
    minWidth: tokens.spacing[5],
    paddingHorizontal: tokens.spacing[1],
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    backgroundColor: tokens.color.dark.accent,
  },
});
