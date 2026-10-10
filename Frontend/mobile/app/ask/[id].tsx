import { useLocalSearchParams, useRouter } from 'expo-router';

import { CreatePostView } from '@snapworth/shared/features/feed';

import { ModalSafeArea } from '../../src/ModalSafeArea';
import { pickItemPhotos } from '../../src/photo-picker';

export default function CreatePostRoute() {
  const router = useRouter();
  const { id, from, outcome } = useLocalSearchParams<{
    id?: string | string[];
    from?: string;
    outcome?: string;
  }>();
  const itemId = Array.isArray(id) ? id[0] : id;

  return (
    <ModalSafeArea>
      <CreatePostView
        itemId={itemId}
        source={from === 'listing' ? 'listing' : 'item'}
        // Preview wiring: `?outcome=held` or `?outcome=blocked` shows what moderation would do.
        outcome={
          outcome === 'held' || outcome === 'blocked' || outcome === 'pending'
            ? outcome
            : 'approved'
        }
        onBack={() => router.back()}
        // Preview wiring: there is no post service yet, so publishing just opens the feed.
        // Dismissing back to it closes the whole snap flow (camera, estimate, this composer),
        // where replacing would leave them stacked behind the feed.
        onPublish={() => router.dismissTo('/feed')}
        onAddPhotos={pickItemPhotos}
      />
    </ModalSafeArea>
  );
}
