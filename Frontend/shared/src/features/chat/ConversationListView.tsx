import { MessageSquare } from 'lucide-react-native';
import { View } from 'react-native';

import {
  Avatar,
  Divider,
  EmptyState,
  LargeTitle,
  Photo,
  Reveal,
  Screen,
  SWText,
  ZoomLink,
} from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
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
  const styles = useThemedStyles(stylesFor);
  const conversations = previewConversations;
  const unread = conversations.reduce((total, conversation) => total + conversation.unread, 0);

  return (
    <Screen
      clearTabBar
      ambient="quiet"
      onRefresh={() => new Promise((resolve) => setTimeout(resolve, 900))}
    >
      <LargeTitle
        title="Chats"
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
  const styles = useThemedStyles(stylesFor);
  const unread = conversation.unread > 0;
  const preview = `${conversation.lastFromMe ? 'You: ' : ''}${conversation.lastMessage}`;

  return (
    <ZoomLink
      href={`/chat/${conversation.id}`}
      label={`Conversation with ${conversation.with.handle} about ${conversation.itemTitle}. ${
        unread ? `${conversation.unread} unread. ` : ''
      }Last message: ${preview}, ${conversation.sentAt}`}
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.media}>
        <Avatar source={conversation.with.avatar} name={conversation.with.handle} size={52} />
        <View style={styles.itemBadge}>
          <Photo
            source={conversation.itemPhoto}
            label={conversation.itemTitle}
            radius={tokens.radius.small}
            style={styles.itemThumb}
          />
        </View>
      </View>
      <View style={styles.text}>
        <View style={styles.topLine}>
          <SWText variant="headingSmall" numberOfLines={1} style={styles.handle}>
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
            variant={unread ? 'label' : 'bodyCompact'}
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
    </ZoomLink>
  );
}

const stylesFor = themedStyles((colors) => ({
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
  media: {
    width: 52,
    height: 52,
  },
  itemBadge: {
    position: 'absolute',
    right: -tokens.spacing[1],
    bottom: -tokens.spacing[1],
    borderRadius: tokens.radius.small,
    borderWidth: tokens.border.focus,
    borderColor: colors.canvas,
    overflow: 'hidden',
  },
  itemThumb: {
    width: 24,
    height: 24,
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
  // Unread count is informational, so it stays small; the accent marks "needs you".
  badge: {
    minWidth: tokens.spacing[5],
    paddingHorizontal: tokens.spacing[1],
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
}));
