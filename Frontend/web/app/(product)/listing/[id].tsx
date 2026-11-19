import { useLocalSearchParams, useRouter } from 'expo-router';

import { ListingDetailView } from '@snapworth/shared/features/marketplace';

import { useShareLink } from '../../../src/share-link';

/** A listing as a moderator sees it: the item, its price and seller, without buying or selling. */
export default function ListingDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const listingId = Array.isArray(id) ? id[0] : id;
  const share = useShareLink();

  return (
    <ListingDetailView
      listingId={listingId}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/marketplace'))}
      onOpenSeller={(sellerHandle) => {
        if (sellerHandle) router.push(`/seller/${sellerHandle}`);
      }}
      onShare={() => share(`/listing/${listingId ?? ''}`, 'For sale on SnapWorth.')}
    />
  );
}
