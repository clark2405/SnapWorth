import { useLocalSearchParams, useRouter } from 'expo-router';

import { SellerProfileView } from '@snapworth/shared/features/profile';

export default function SellerProfileRoute() {
  const router = useRouter();
  const { handle } = useLocalSearchParams<{ handle?: string | string[] }>();
  const sellerHandle = Array.isArray(handle) ? handle[0] : handle;

  return (
    <SellerProfileView
      handle={sellerHandle}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/marketplace'))}
      onOpenListing={(listingId) => router.push(`/listing/${listingId}`)}
    />
  );
}
