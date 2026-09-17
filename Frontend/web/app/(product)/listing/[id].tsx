import { useLocalSearchParams } from 'expo-router';

import { ListingDetailView } from '@snapworth/shared/features/placeholder-views';

export default function ListingDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const listingId = Array.isArray(id) ? id[0] : id;

  return <ListingDetailView listingId={listingId} />;
}
