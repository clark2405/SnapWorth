import { useRouter } from 'expo-router';

import { ConversationListView } from '@snapworth/shared/features/chat';

export default function ConversationListRoute() {
  const router = useRouter();

  return (
    <ConversationListView
      onOpenConversation={(conversationId) => router.push(`/chat/${conversationId}`)}
      onOpenProfile={() => router.push('/profile')}
      onBrowseMarket={() => router.replace('/marketplace')}
    />
  );
}
