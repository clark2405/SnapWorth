import { useRouter } from 'expo-router';

import { GuessView } from '@snapworth/shared/features/guess';

export default function GuessRoute() {
  const router = useRouter();

  return (
    <GuessView
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/feed'))}
      onOpenListing={(listingId) => router.push(`/listing/${listingId}`)}
    />
  );
}
