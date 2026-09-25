import { useLocalSearchParams, useRouter } from 'expo-router';

import { ConfirmPriceView } from '@snapworth/shared/features/marketplace';

import { ModalSafeArea } from '../../src/ModalSafeArea';

export default function CreateListingRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const itemId = Array.isArray(id) ? id[0] : id;

  return (
    <ModalSafeArea>
      <ConfirmPriceView
        itemId={itemId}
        onBack={() => router.back()}
        onPublish={() => router.replace('/marketplace')}
      />
    </ModalSafeArea>
  );
}
