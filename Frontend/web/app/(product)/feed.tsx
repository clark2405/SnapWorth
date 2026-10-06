import { useRouter } from 'expo-router';

import { FeedView } from '@snapworth/shared/features/feed';
import { useAccountGate } from '@snapworth/shared/features/session';

export default function FeedRoute() {
  const router = useRouter();
  const requireAccount = useAccountGate();

  return (
    <FeedView
      onOpenPost={(postId) => router.push(`/post/${postId}`)}
      onSearch={() => router.push('/search?scope=feed')}
      onOpenProfile={() => router.push('/profile')}
      onSnap={() => requireAccount('snap', () => router.push('/capture'))}
    />
  );
}
