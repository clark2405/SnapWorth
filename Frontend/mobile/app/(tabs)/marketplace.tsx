import { useRouter } from 'expo-router';

import { MarketplaceView } from '@snapworth/shared/features/marketplace';

export default function MarketplaceRoute() {
  const router = useRouter();

  return (
    <MarketplaceView
      onOpenListing={(listingId) => router.push(`/listing/${listingId}`)}
      onOpenProfile={() => router.push('/profile')}
    />
  );
}
