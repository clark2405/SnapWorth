import { useRouter } from 'expo-router';

import { formatSearchOrigin } from '@snapworth/shared/components';
import { FeedView } from '@snapworth/shared/features/feed';

export default function FeedRoute() {
  const router = useRouter();

  return (
    <FeedView
      onOpenPost={(postId) => router.push(`/post/${postId}`)}
      onSearch={(origin) =>
        router.push({
          pathname: '/search',
          params: { scope: 'feed', ...(origin ? { from: formatSearchOrigin(origin) } : {}) },
        })
      }
      onOpenProfile={() => router.push('/profile')}
    />
  );
}
