import { useLocalSearchParams, useRouter } from 'expo-router';

import { ListingDetailView } from '@snapworth/shared/features/marketplace';

export default function ListingDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const listingId = Array.isArray(id) ? id[0] : id;

  return (
    <ListingDetailView
      listingId={listingId}
      onBack={() => router.back()}
      onMessageSeller={() => router.push(`/chat/${listingId ?? ''}`)}
      // Preview wiring: every sample listing detail belongs to the one sample seller.
      onOpenSeller={() => router.push('/seller/mariacruz')}
    />
  );
}
