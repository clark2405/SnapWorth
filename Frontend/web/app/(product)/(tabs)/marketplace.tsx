import { useRouter } from 'expo-router';

import { MarketplaceView } from '@snapworth/shared/features/marketplace';

// Selling starts with Snap, in the tab bar (or, on a wide window, the sidebar), as on iOS.
export default function MarketplaceRoute() {
  const router = useRouter();

  return (
    <MarketplaceView
      onOpenListing={(listingId) => router.push(`/listing/${listingId}`)}
      onOpenProfile={() => router.push('/profile')}
      onOpenHanap={() => router.push('/hanap')}
    />
  );
}
