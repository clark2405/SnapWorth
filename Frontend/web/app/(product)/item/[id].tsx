import { useLocalSearchParams, useRouter } from 'expo-router';

import { EstimateResultView } from '@snapworth/shared/features/item';

export default function ItemDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const itemId = Array.isArray(id) ? id[0] : id;

  return (
    <EstimateResultView
      itemId={itemId}
      onBack={() => router.back()}
      onPostToFeed={() => router.push('/feed')}
      onListForSale={() => router.push(`/list/${itemId ?? ''}`)}
      onKeepPrivate={() => router.push('/history')}
    />
  );
}
