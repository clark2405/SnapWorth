import { useLocalSearchParams, useRouter } from 'expo-router';

import { CreatePostView } from '@snapworth/shared/features/feed';

import { ModalSafeArea } from '../../src/ModalSafeArea';

export default function CreatePostRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const itemId = Array.isArray(id) ? id[0] : id;

  return (
    <ModalSafeArea>
      <CreatePostView
        itemId={itemId}
        onBack={() => router.back()}
        // Preview wiring: there is no post service yet, so publishing just opens the feed.
        onPublish={() => router.replace('/feed')}
      />
    </ModalSafeArea>
  );
}
