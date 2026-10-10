import { useLocalSearchParams, useRouter } from 'expo-router';

import { ConfirmPriceView } from '@snapworth/shared/features/marketplace';

import { ModalSafeArea } from '../../src/ModalSafeArea';
import { pickItemPhotos } from '../../src/photo-picker';

export default function CreateListingRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const itemId = Array.isArray(id) ? id[0] : id;

  return (
    <ModalSafeArea>
      <ConfirmPriceView
        itemId={itemId}
        onBack={() => router.back()}
        // Back to the market, closing the snap flow behind it rather than stacking on top.
        onPublish={() => router.dismissTo('/marketplace')}
        onAddPhotos={pickItemPhotos}
      />
    </ModalSafeArea>
  );
}
