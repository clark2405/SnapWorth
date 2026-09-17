import { useLocalSearchParams } from 'expo-router';

import { ConversationView } from '@snapworth/shared/features/placeholder-views';

export default function ConversationRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const conversationId = Array.isArray(id) ? id[0] : id;

  return <ConversationView conversationId={conversationId} />;
}
