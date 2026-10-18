import { useLocalSearchParams, useRouter } from 'expo-router';

import { ListingDetailView } from '@snapworth/shared/features/marketplace';

import { useShareLink } from '../../../src/share-link';

export default function ListingDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const listingId = Array.isArray(id) ? id[0] : id;
  const share = useShareLink();

  return (
    <ListingDetailView
      listingId={listingId}
      onBack={() => router.back()}
      onMessageSeller={() => router.push(`/chat/${listingId ?? ''}`)}
      // Preview wiring: every sample listing detail belongs to the one sample seller.
      onOpenSeller={() => router.push('/seller/mariacruz')}
      // Owner actions on the seller's own listing.
      onAskFeed={() => router.push(`/ask/${listingId ?? ''}?from=listing`)}
      onEditPrice={() => router.push(`/list/${listingId ?? ''}`)}
      onShare={() => share(`/listing/${listingId ?? ''}`, 'For sale on SnapWorth.')}
      onMarkSold={() => router.replace('/history')}
    />
  );
}
