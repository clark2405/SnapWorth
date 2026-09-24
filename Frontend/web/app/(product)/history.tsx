import { useRouter } from 'expo-router';

import { HistoryView } from '@snapworth/shared/features/history';

export default function HistoryRoute() {
  const router = useRouter();

  return (
    <HistoryView
      onOpenItem={(itemId) => router.push(`/item/${itemId}`)}
      onSearch={() => router.push('/search?scope=history')}
      onOpenProfile={() => router.push('/profile')}
    />
  );
}
