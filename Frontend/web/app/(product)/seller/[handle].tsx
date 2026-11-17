import { useLocalSearchParams, useRouter } from 'expo-router';

import { useMessageSeller } from '@snapworth/shared/features/chat';
import { SellerProfileView } from '@snapworth/shared/features/profile';

export default function SellerProfileRoute() {
  const router = useRouter();
  const messageSeller = useMessageSeller();
  const { handle } = useLocalSearchParams<{ handle?: string | string[] }>();
  const sellerHandle = Array.isArray(handle) ? handle[0] : handle;

  return (
    <SellerProfileView
      handle={sellerHandle}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/marketplace'))}
      onOpenListing={(listingId) => router.push(`/listing/${listingId}`)}
      onOpenPost={(postId) => router.push(`/post/${postId}`)}
      onMessage={async (listingSlug) => {
        const conversationId = await messageSeller(listingSlug);
        if (conversationId) router.push(`/chat/${conversationId}`);
      }}
    />
  );
}
