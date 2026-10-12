import { useRouter } from 'expo-router';

import { MarketplaceView } from '@snapworth/shared/features/marketplace';
import { useAccountGate } from '@snapworth/shared/features/session';

export default function MarketplaceRoute() {
  const router = useRouter();
  const requireAccount = useAccountGate();

  return (
    <MarketplaceView
      onOpenListing={(listingId) => router.push(`/listing/${listingId}`)}
      onSell={() => requireAccount('sell', () => router.push('/capture'))}
      onOpenProfile={() => router.push('/profile')}
    />
  );
}
