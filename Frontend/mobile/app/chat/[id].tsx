import { useLocalSearchParams, useRouter } from 'expo-router';

import { ConversationView } from '@snapworth/shared/features/chat';

export default function ConversationRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const conversationId = Array.isArray(id) ? id[0] : id;

  return <ConversationView conversationId={conversationId} onBack={() => router.back()} />;
}
