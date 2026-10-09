import { useRouter } from 'expo-router';

import { EditProfileView } from '@snapworth/shared/features/profile';

import { pickItemPhotos } from '../../src/photo-picker';

export default function EditProfileRoute() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  return (
    <EditProfileView
      onBack={back}
      onSaved={back}
      onPickPhoto={async () => (await pickItemPhotos(1))[0]?.source ?? null}
    />
  );
}
