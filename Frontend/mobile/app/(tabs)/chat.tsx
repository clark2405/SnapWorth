import { useRouter } from 'expo-router';

import { ConversationListView } from '@snapworth/shared/features/chat';
import { AccountGateView, useSession } from '@snapworth/shared/features/session';

export default function ConversationListRoute() {
  const router = useRouter();
  const { isGuest } = useSession();

  if (isGuest) return <AccountGateView title="Chats" intent="chats" />;

  return (
    <ConversationListView
      onOpenConversation={(conversationId) => router.push(`/chat/${conversationId}`)}
      onOpenProfile={() => router.push('/profile')}
      onBrowseMarket={() => router.replace('/marketplace')}
    />
  );
}
