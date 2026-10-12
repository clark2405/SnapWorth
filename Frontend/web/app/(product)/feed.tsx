import { useRouter } from 'expo-router';

import { FeedView } from '@snapworth/shared/features/feed';
import { useAccountGate } from '@snapworth/shared/features/session';

import { useShareLink } from '../../src/share-link';

export default function FeedRoute() {
  const router = useRouter();
  const share = useShareLink();
  const requireAccount = useAccountGate();

  return (
    <FeedView
      onOpenPost={(postId) => router.push(`/post/${postId}`)}
      onSharePost={(postId) => share(`/post/${postId}`, 'Is this priced right? Vote on SnapWorth.')}
      onSearch={() => router.push('/search?scope=feed')}
      onOpenProfile={() => router.push('/profile')}
      onOpenTrend={(trend) => router.push(`/trend/${trend}`)}
      onSnap={() => requireAccount('snap', () => router.push('/capture'))}
    />
  );
}
