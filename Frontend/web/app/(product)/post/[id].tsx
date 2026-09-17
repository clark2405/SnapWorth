import { useLocalSearchParams } from 'expo-router';

import { PostDetailView } from '@snapworth/shared/features/placeholder-views';

export default function PostDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const postId = Array.isArray(id) ? id[0] : id;

  return <PostDetailView postId={postId} />;
}
