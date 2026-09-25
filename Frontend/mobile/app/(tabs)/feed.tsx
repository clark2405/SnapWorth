import { useRouter } from 'expo-router';

import { FeedView } from '@snapworth/shared/features/feed';

export default function FeedRoute() {
  const router = useRouter();

  return (
    <FeedView
      onOpenPost={(postId) => router.push(`/post/${postId}`)}
      onSearch={() => router.push('/search?scope=feed')}
      onOpenProfile={() => router.push('/profile')}
    />
  );
}
