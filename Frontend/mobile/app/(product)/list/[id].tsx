import { useLocalSearchParams, useRouter } from 'expo-router';

import { ConfirmPriceView } from '@snapworth/shared/features/marketplace';

export default function CreateListingRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const itemId = Array.isArray(id) ? id[0] : id;

  return (
    <ConfirmPriceView
      itemId={itemId}
      onBack={() => router.back()}
      onPublish={() => router.replace('/marketplace')}
    />
  );
}
