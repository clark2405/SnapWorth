import { useLocalSearchParams, useRouter } from 'expo-router';

import { CreatePostView } from '@snapworth/shared/features/feed';

export default function CreatePostRoute() {
  const router = useRouter();
  const { id, from, outcome } = useLocalSearchParams<{
    id?: string | string[];
    from?: string;
    outcome?: string;
  }>();
  const itemId = Array.isArray(id) ? id[0] : id;

  return (
    <CreatePostView
      itemId={itemId}
      source={from === 'listing' ? 'listing' : 'item'}
      // Preview wiring: `?outcome=held` or `?outcome=blocked` shows what moderation would do.
      outcome={
        outcome === 'held' || outcome === 'blocked' || outcome === 'pending' ? outcome : 'approved'
      }
      onBack={() => router.back()}
      // Preview wiring: there is no post service yet, so publishing just opens the feed.
      onPublish={() => router.replace('/feed')}
    />
  );
}
