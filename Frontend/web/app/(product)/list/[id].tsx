import { useLocalSearchParams } from 'expo-router';

import { CreateListingView } from '@snapworth/shared/features/placeholder-views';

export default function CreateListingRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const itemId = Array.isArray(id) ? id[0] : id;

  return <CreateListingView itemId={itemId} />;
}
