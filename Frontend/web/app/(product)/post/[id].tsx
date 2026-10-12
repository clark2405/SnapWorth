import { useLocalSearchParams, useRouter } from 'expo-router';

import { PostDetailView } from '@snapworth/shared/features/feed';

import { useShareLink } from '../../../src/share-link';

export default function PostDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const postId = Array.isArray(id) ? id[0] : id;
  const share = useShareLink();

  return (
    <PostDetailView
      postId={postId}
      onBack={() => router.back()}
      onOpenListing={(listingId) => router.push(`/listing/${listingId}`)}
      onListForSale={(id) => router.push(`/list/${id}`)}
      onShare={() => share(`/post/${postId ?? ''}`, 'Is this priced right? Vote on SnapWorth.')}
    />
  );
}
