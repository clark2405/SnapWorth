import { useLocalSearchParams, useRouter } from 'expo-router';

import { HistoryView } from '@snapworth/shared/features/history';
import { AccountGateView, useSession } from '@snapworth/shared/features/session';

export default function HistoryRoute() {
  const router = useRouter();
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const { isGuest } = useSession();

  if (isGuest) return <AccountGateView title="History" intent="history" />;

  return (
    <HistoryView
      initialFilter={filter}
      onOpenItem={(itemId) => router.push(`/item/${itemId}`)}
      onListItem={(itemId) => router.push(`/list/${itemId}`)}
      onSearch={() => router.push('/search?scope=history')}
      onOpenProfile={() => router.push('/profile')}
      onSnap={() => router.push('/capture')}
    />
  );
}
