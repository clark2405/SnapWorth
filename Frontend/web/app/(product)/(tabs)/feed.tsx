import { useRouter } from 'expo-router';

import { useWideLayout } from '@snapworth/shared/design';
import { FeedView } from '@snapworth/shared/features/feed';
import { useAccountGate } from '@snapworth/shared/features/session';

import { useShareLink } from '../../../src/share-link';

export default function FeedRoute() {
  const router = useRouter();
  // On a wide window the sidebar carries Snap and Search, so the header doesn't repeat them.
  const wide = useWideLayout();
  const share = useShareLink();
  const requireAccount = useAccountGate();

  return (
    <FeedView
      onOpenPost={(postId) => router.push(`/post/${postId}`)}
      onSharePost={(postId) => share(`/post/${postId}`, 'Is this priced right? Vote on SnapWorth.')}
      onSearch={wide ? undefined : () => router.push('/search?scope=feed')}
      onOpenProfile={() => router.push('/profile')}
      onOpenTrend={(trend) => router.push(`/trend/${trend}`)}
      onSnap={wide ? undefined : () => requireAccount('snap', () => router.push('/capture'))}
    />
  );
}
