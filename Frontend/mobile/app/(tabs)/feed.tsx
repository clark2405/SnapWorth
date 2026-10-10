import { useRouter } from 'expo-router';

import { FeedView } from '@snapworth/shared/features/feed';

import { useShareLink } from '../../src/share-link';

export default function FeedRoute() {
  const router = useRouter();
  const share = useShareLink();

  return (
    <FeedView
      onOpenPost={(postId) => router.push(`/post/${postId}`)}
      onSharePost={(postId) => share(`/post/${postId}`, 'Is this priced right? Vote on SnapWorth.')}
      onOpenProfile={() => router.push('/profile')}
      onOpenTrend={(trend) => router.push(`/trend/${trend}`)}
    />
  );
}
