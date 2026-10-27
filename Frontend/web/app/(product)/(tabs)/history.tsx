import { useLocalSearchParams, useRouter } from 'expo-router';

import { useWideLayout } from '@snapworth/shared/design';
import { HistoryView } from '@snapworth/shared/features/history';
import { AccountGateView, useSession } from '@snapworth/shared/features/session';

export default function HistoryRoute() {
  const router = useRouter();
  // On a wide window the sidebar carries Snap and Search, so the header doesn't repeat them.
  const wide = useWideLayout();
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const { isGuest } = useSession();

  if (isGuest) return <AccountGateView title="History" intent="history" />;

  return (
    <HistoryView
      initialFilter={filter}
      onOpenItem={(itemId) => router.push(`/item/${itemId}`)}
      onListItem={(itemId) => router.push(`/list/${itemId}`)}
      onSearch={wide ? undefined : () => router.push('/search?scope=history')}
      onOpenProfile={() => router.push('/profile')}
      onSnap={wide ? undefined : () => router.push('/capture')}
    />
  );
}
