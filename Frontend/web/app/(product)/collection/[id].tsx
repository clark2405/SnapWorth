import { useLocalSearchParams, useRouter } from 'expo-router';

import { CollectionView } from '@snapworth/shared/features/history';
import { AccountGateView, useSession } from '@snapworth/shared/features/session';

export default function CollectionRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const { isGuest } = useSession();

  if (isGuest) return <AccountGateView title="Collection" intent="history" />;

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/history'));
  return (
    <CollectionView
      collectionId={Array.isArray(id) ? id[0] : id}
      onBack={leave}
      onDeleted={leave}
      onOpenItem={(itemId) => router.push(`/item/${itemId}`)}
    />
  );
}
