import { useLocalSearchParams, useRouter } from 'expo-router';
import { Share } from 'react-native';

import { PostDetailView } from '@snapworth/shared/features/feed';

export default function PostDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const postId = Array.isArray(id) ? id[0] : id;

  return (
    <PostDetailView
      postId={postId}
      onBack={() => router.back()}
      onShare={() => {
        Share.share({
          message: `Check the estimate on this SnapWorth post: snapworth://post/${postId ?? ''}`,
        }).catch(() => undefined);
      }}
    />
  );
}
