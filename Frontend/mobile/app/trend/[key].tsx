import { useLocalSearchParams, useRouter } from 'expo-router';

import { useToast } from '@snapworth/shared/components';
import { useAccountGate } from '@snapworth/shared/features/session';
import { TrendView } from '@snapworth/shared/features/trends';

export default function TrendRoute() {
  const router = useRouter();
  const toast = useToast();
  const requireAccount = useAccountGate();
  const { key } = useLocalSearchParams<{ key?: string | string[] }>();

  return (
    <TrendView
      trendKey={Array.isArray(key) ? key[0] : key}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/feed'))}
      // Preview wiring: there are no share links yet.
      onShare={() => toast.show({ title: 'Link copied' })}
      onOpenListing={(listingId) => router.push(`/listing/${listingId}`)}
      onOpenPost={(postId) => router.push(`/post/${postId}`)}
      onSnap={() => requireAccount('snap', () => router.push('/capture'))}
    />
  );
}
