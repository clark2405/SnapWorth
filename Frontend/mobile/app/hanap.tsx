import { useRouter } from 'expo-router';

import { HanapView } from '@snapworth/shared/features/hanap';

export default function HanapRoute() {
  const router = useRouter();

  return (
    <HanapView
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/marketplace'))}
      onOpenListing={(listingId) => router.push(`/listing/${listingId}`)}
      onSnap={() => router.push('/capture')}
    />
  );
}
