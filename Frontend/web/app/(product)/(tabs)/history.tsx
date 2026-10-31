import { useLocalSearchParams, useRouter } from 'expo-router';

import { HistoryView } from '@snapworth/shared/features/history';
import { AccountGateView, useSession } from '@snapworth/shared/features/session';

// Snap and Search live in the tab bar (or, on a wide window, the sidebar), as on iOS, so the
// header doesn't repeat them.
export default function HistoryRoute() {
  const router = useRouter();
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const { isGuest } = useSession();

  if (isGuest) return <AccountGateView title="History" intent="history" />;

  return (
    <HistoryView
      initialFilter={filter}
      onOpenCollection={(collectionId) => router.push(`/collection/${collectionId}`)}
      onOpenItem={(itemId) => router.push(`/item/${itemId}`)}
      onListItem={(itemId) => router.push(`/list/${itemId}`)}
      onOpenProfile={() => router.push('/profile')}
    />
  );
}
