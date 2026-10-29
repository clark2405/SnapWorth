import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { themedStyles, tokens, useThemedStyles, useWideLayout } from '@snapworth/shared/design';
import {
  ConversationListView,
  ConversationView,
  useFirstOpenConversationId,
} from '@snapworth/shared/features/chat';
import { AccountGateView, useSession } from '@snapworth/shared/features/session';

/**
 * Chats. On a phone the list opens each conversation on a screen of its own; on a wide window
 * the conversation opens beside the list, the way a desktop mail or messages app works.
 */
export default function ConversationListRoute() {
  const router = useRouter();
  const styles = useThemedStyles(stylesFor);
  const { isGuest } = useSession();
  const wide = useWideLayout();
  const firstOpenId = useFirstOpenConversationId();
  const [pickedId, setPickedId] = useState<string>();
  const openId = pickedId ?? firstOpenId;

  if (isGuest) return <AccountGateView title="Chats" intent="chats" />;

  const list = (
    <ConversationListView
      selectedId={wide ? openId : undefined}
      onOpenConversation={(conversationId) =>
        wide ? setPickedId(conversationId) : router.push(`/chat/${conversationId}`)
      }
      onOpenProfile={() => router.push('/profile')}
      onBrowseMarket={() => router.replace('/marketplace')}
    />
  );
  if (!wide) return list;

  return (
    <View style={styles.split}>
      <View style={styles.list}>{list}</View>
      <View style={styles.conversation}>
        {/* A fresh conversation for each one opened, so drafts and sheets never carry over. */}
        {openId ? (
          <ConversationView
            key={openId}
            conversationId={openId}
            onViewItem={(listingKey) => router.push(`/listing/${listingKey}`)}
          />
        ) : null}
      </View>
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  split: {
    flex: 1,
    flexDirection: 'row',
  },
  list: {
    width: listWidth,
    borderRightWidth: tokens.border.hairline,
    borderRightColor: colors.borderSubtle,
  },
  conversation: {
    flex: 1,
  },
}));

const listWidth = 400;
