import { Archive, MessageSquare, MessagesSquare } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import {
  Avatar,
  Divider,
  Surface,
  EmptyState,
  LargeTitle,
  Photo,
  Reveal,
  Screen,
  SegmentedControl,
  SWText,
  Tag,
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
  const [view, setView] = useState<'open' | 'past'>('open');
  const open = previewConversations.filter((conversation) => !conversation.closed);
  const past = previewConversations.filter((conversation) => conversation.closed);
  const conversations = view === 'open' ? open : past;
  const unread = open.reduce((total, conversation) => total + conversation.unread, 0);

  return (
    <Screen
      clearTabBar
      ambient="chat"
      onRefresh={() => new Promise((resolve) => setTimeout(resolve, 900))}
    >
      <LargeTitle
        brand
        title="Chats"
        overlineIcon={unread > 0 ? MessagesSquare : undefined}
        overline={unread > 0 ? `${unread} unread` : undefined}
        trailing={<ProfileButton onPress={onOpenProfile} />}
      />
      {previewConversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          body="Message a seller from any listing and the conversation appears here."
          actionLabel="Browse the market"
          onAction={onBrowseMarket}
        />
      ) : (
        <View style={styles.body}>
          <SegmentedControl
            options={[
              { key: 'open', label: 'Open' },
              { key: 'past', label: 'Past' },
            ]}
            value={view}
            onChange={setView}
          />
          <Animated.View
            key={view}
            entering={FadeIn.duration(tokens.motion.duration.base)}
            exiting={FadeOut.duration(tokens.motion.duration.fast)}
          >
            {conversations.length === 0 ? (
              <EmptyState
                icon={view === 'open' ? MessageSquare : Archive}
                title={view === 'open' ? 'No open chats' : 'Nothing here yet'}
                body={
                  view === 'open'
                    ? 'Message a seller from any listing to start one.'
                    : 'Chats about sold or archived items move here.'
                }
              />
            ) : (
              <Surface padding={tokens.spacing[2]}>
                {conversations.map((conversation, index) => (
                  <Reveal key={conversation.id} index={index}>
                    {index > 0 ? <Divider style={styles.divider} /> : null}
                    <ConversationRow
                      conversation={conversation}
                      onPress={() => onOpenConversation?.(conversation.id)}
                    />
                  </Reveal>
                ))}
              </Surface>
            )}
          </Animated.View>
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
        <Avatar source={conversation.with.avatar} name={conversation.with.handle} size={48} />
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
        <View style={styles.itemLine}>
          <SWText variant="caption" tone="textMuted" numberOfLines={1} style={styles.preview}>
            {conversation.itemTitle}
          </SWText>
          {conversation.closed ? (
            <Tag label={conversation.closed === 'sold' ? 'Sold' : 'Archived'} tone="grave" />
          ) : null}
        </View>
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
  body: {
    gap: tokens.spacing[4],
  },
  itemLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  divider: {
    marginLeft: tokens.spacing[3] + 48 + tokens.spacing[3],
    marginRight: tokens.spacing[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    padding: tokens.spacing[3],
    borderRadius: tokens.radius.medium,
  },
  media: {
    width: 48,
    height: 48,
  },
  itemBadge: {
    position: 'absolute',
    right: -tokens.spacing[1],
    bottom: -tokens.spacing[1],
    borderRadius: tokens.radius.small,
    borderWidth: tokens.border.focus,
    borderColor: colors.surface,
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
  // The unread count is the urgent number on this screen, so it alone may wear the accent.
  badge: {
    minWidth: tokens.spacing[5],
    paddingHorizontal: tokens.spacing[1],
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
}));
