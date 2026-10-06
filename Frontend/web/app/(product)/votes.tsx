import { useRouter } from 'expo-router';

import { VotesView } from '@snapworth/shared/features/profile';

export default function VotesRoute() {
  const router = useRouter();

  return (
    <VotesView
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
      onOpenPost={(postId) => router.push(`/post/${postId}`)}
      onBrowseFeed={() => router.replace('/feed')}
    />
  );
}
