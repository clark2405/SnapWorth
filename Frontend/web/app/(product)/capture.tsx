import { useRouter } from 'expo-router';
import { useState } from 'react';

import { CaptureView } from '@snapworth/shared/features/capture';

export default function CaptureRoute() {
  const router = useRouter();
  const [flashOn, setFlashOn] = useState(false);

  return (
    <CaptureView
      flashOn={flashOn}
      onToggleFlash={() => setFlashOn((value) => !value)}
      onClose={() => (router.canGoBack() ? router.back() : router.replace('/feed'))}
      // Preview wiring: capture and estimation services are not built yet, so the shutter
      // opens the sample estimate.
      onCapture={() => router.push('/item/nike-neon-windbreaker?fresh=1')}
      onOpenHistory={() => router.push('/history')}
    />
  );
}
