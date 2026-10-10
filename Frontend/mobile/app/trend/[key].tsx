import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAccountGate } from '@snapworth/shared/features/session';
import { TrendView } from '@snapworth/shared/features/trends';

import { useShareLink } from '../../src/share-link';

export default function TrendRoute() {
  const router = useRouter();
  const share = useShareLink();
  const requireAccount = useAccountGate();
  const { key } = useLocalSearchParams<{ key?: string | string[] }>();
  const trendKey = Array.isArray(key) ? key[0] : key;

  return (
    <TrendView
      trendKey={trendKey}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/feed'))}
      onShare={() => share(`/trend/${trendKey ?? ''}`, 'What’s hot right now on SnapWorth.')}
      onOpenListing={(listingId) => router.push(`/listing/${listingId}`)}
      onOpenPost={(postId) => router.push(`/post/${postId}`)}
      onSnap={() => requireAccount('snap', () => router.push('/capture'))}
    />
  );
}
