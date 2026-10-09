import { useRouter } from 'expo-router';

import { PriceAlertsView } from '@snapworth/shared/features/profile';

export default function PriceAlertsRoute() {
  const router = useRouter();

  return (
    <PriceAlertsView
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
      onOpenListing={(listingId) => router.push(`/listing/${listingId}`)}
      onBrowseMarket={() => router.replace('/marketplace')}
    />
  );
}
