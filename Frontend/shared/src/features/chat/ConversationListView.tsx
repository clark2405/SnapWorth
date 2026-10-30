import { Archive, MessageSquare, MessagesSquare } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import {
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
import type { ConversationSummary } from '../../types/entities';
import { AuthorAvatar } from '../feed/CommentList';
import { previewPhotoByListingKey } from '../preview/sample-data';
import { ProfileButton } from '../profile/ProfileButton';
import { describeLatest, formatListTime } from './chat-format';
import { useConversationList } from './chat-state';

export interface ConversationListViewProps {
  readonly onOpenConversation?: (conversationId: string) => void;
  readonly onOpenProfile?: () => void;
  readonly onBrowseMarket?: () => void;
  /** The conversation open beside the list, where there's room for both; it's marked as open. */
  readonly selectedId?: string;
}

/** The conversation a list opens on when it has room to show one beside it. */
export function useFirstOpenConversationId(): string | undefined {
  const { conversations } = useConversationList();
  return conversations.find((entry) => !entry.closed)?.id;
}

export function ConversationListView({
  onOpenConversation,
  onOpenProfile,
  onBrowseMarket,
  selectedId,
}: ConversationListViewProps) {
  const styles = useThemedStyles(stylesFor);
  const [view, setView] = useState<'open' | 'past'>('open');
  const list = useConversationList();
  const open = list.conversations.filter((conversation) => !conversation.closed);
  const past = list.conversations.filter((conversation) => conversation.closed);
  const conversations = view === 'open' ? open : past;
  const unread = open.reduce((total, conversation) => total + conversation.unread, 0);

  return (
    <Screen clearTabBar place="chat" ambient="chat" onRefresh={list.refresh}>
      <LargeTitle
        brand
        title="Chats"
        overlineIcon={unread > 0 ? MessagesSquare : undefined}
        overline={unread > 0 ? `${unread} unread` : undefined}
        trailing={<ProfileButton onPress={onOpenProfile} />}
      />
      {list.status === 'failed' && list.conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Couldn’t load your chats"
          body="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void list.refresh()}
        />
      ) : list.status === 'loading' ? null : list.conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No chats yet"
          body="Message a seller from any listing and the conversation lands here."
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
                      selected={conversation.id === selectedId}
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
  selected = false,
  onPress,
}: {
  conversation: ConversationSummary;
  selected?: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const unread = conversation.unread > 0;
  const preview = `${conversation.latest?.fromMe ? 'You: ' : ''}${describeLatest(conversation.latest)}`;
  const sentAt = formatListTime(conversation.latestActivityAt);
  const handle = conversation.other.handle;
  const title = conversation.listing.title;
  const photo = conversation.listing.photoUrl
    ? { uri: conversation.listing.photoUrl }
    : previewPhotoByListingKey[conversation.listing.key];

  return (
    <ZoomLink
      href={`/chat/${conversation.id}`}
      label={`Conversation with ${handle} about ${title}. ${
        unread ? `${conversation.unread} unread. ` : ''
      }Last message: ${preview}, ${sentAt}`}
      onPress={onPress}
      style={[styles.row, selected ? styles.rowSelected : null]}
    >
      <View style={styles.media}>
        <AuthorAvatar handle={handle} avatarUrl={conversation.other.avatarUrl} size={48} />
        {photo ? (
          <View style={styles.itemBadge}>
            <Photo
              source={photo}
              label={title}
              radius={tokens.radius.small}
              style={styles.itemThumb}
            />
          </View>
        ) : null}
      </View>
      <View style={styles.text}>
        <View style={styles.topLine}>
          <SWText variant="headingSmall" numberOfLines={1} style={styles.handle}>
            @{handle}
          </SWText>
          <SWText variant="caption" tone={unread ? 'textPrimary' : 'textMuted'}>
            {sentAt}
          </SWText>
        </View>
        <View style={styles.itemLine}>
          <SWText variant="caption" tone="textMuted" numberOfLines={1} style={styles.preview}>
            {title}
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
  rowSelected: {
    backgroundColor: colors.sunken,
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
