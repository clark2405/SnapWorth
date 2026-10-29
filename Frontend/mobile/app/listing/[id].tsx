import { useLocalSearchParams, useRouter } from 'expo-router';

import { useMessageSeller } from '@snapworth/shared/features/chat';
import { ListingDetailView } from '@snapworth/shared/features/marketplace';

import { useShareLink } from '../../src/share-link';

export default function ListingDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const listingId = Array.isArray(id) ? id[0] : id;
  const messageSeller = useMessageSeller();
  const share = useShareLink();

  return (
    <ListingDetailView
      listingId={listingId}
      onBack={() => router.back()}
      onMessageSeller={async () => {
        const conversationId = listingId ? await messageSeller(listingId) : null;
        if (conversationId) router.push(`/chat/${conversationId}`);
      }}
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
