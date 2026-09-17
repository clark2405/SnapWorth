import { useLocalSearchParams } from 'expo-router';

import { ItemDetailView } from '@snapworth/shared/features/placeholder-views';

export default function ItemDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const itemId = Array.isArray(id) ? id[0] : id;

  return <ItemDetailView itemId={itemId} />;
}
