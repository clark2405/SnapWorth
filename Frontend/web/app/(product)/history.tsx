import { useLocalSearchParams, useRouter } from 'expo-router';

import { HistoryView } from '@snapworth/shared/features/history';

export default function HistoryRoute() {
  const router = useRouter();
  const { filter } = useLocalSearchParams<{ filter?: string }>();

  return (
    <HistoryView
      initialFilter={filter}
      onOpenItem={(itemId) => router.push(`/item/${itemId}`)}
      onListItem={(itemId) => router.push(`/list/${itemId}`)}
      onSearch={() => router.push('/search?scope=history')}
      onOpenProfile={() => router.push('/profile')}
    />
  );
}
