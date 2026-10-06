import { useLocalSearchParams, useRouter } from 'expo-router';

import { formatSearchOrigin } from '@snapworth/shared/components';
import { HistoryView } from '@snapworth/shared/features/history';

export default function HistoryRoute() {
  const router = useRouter();
  const { filter } = useLocalSearchParams<{ filter?: string }>();

  return (
    <HistoryView
      initialFilter={filter}
      onOpenItem={(itemId) => router.push(`/item/${itemId}`)}
      onListItem={(itemId) => router.push(`/list/${itemId}`)}
      onSearch={(origin) =>
        router.push({
          pathname: '/search',
          params: { scope: 'history', ...(origin ? { from: formatSearchOrigin(origin) } : {}) },
        })
      }
      onOpenProfile={() => router.push('/profile')}
    />
  );
}
