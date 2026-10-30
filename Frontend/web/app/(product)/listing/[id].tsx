import { useLocalSearchParams, useRouter } from 'expo-router';

import { useMessageSeller, useOfferToSeller } from '@snapworth/shared/features/chat';
import { ListingDetailView } from '@snapworth/shared/features/marketplace';

import { useShareLink } from '../../../src/share-link';

export default function ListingDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const listingId = Array.isArray(id) ? id[0] : id;
  const messageSeller = useMessageSeller();
  const offerToSeller = useOfferToSeller();
  const share = useShareLink();

  return (
    <ListingDetailView
      listingId={listingId}
      onBack={() => router.back()}
      onMessageSeller={async () => {
        const conversationId = listingId ? await messageSeller(listingId) : null;
        if (conversationId) router.push(`/chat/${conversationId}`);
      }}
      // The offer lands in the chat with the seller, which opens on it.
      onSendOffer={async (amountPhp) => {
        const conversationId = listingId ? await offerToSeller(listingId, amountPhp) : null;
        if (conversationId) router.push(`/chat/${conversationId}`);
        return conversationId !== null;
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
