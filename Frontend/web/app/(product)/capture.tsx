import { useRouter } from 'expo-router';
import { useState } from 'react';

import { CaptureView } from '@snapworth/shared/features/capture';
import { AccountGateView, useSession } from '@snapworth/shared/features/session';
import { useTip } from '@snapworth/shared/features/tips';

export default function CaptureRoute() {
  const router = useRouter();
  const [flashOn, setFlashOn] = useState(false);
  const { isGuest } = useSession();
  // Taking a photo is what the Snap tip teaches, so doing it retires the tip.
  const snapTip = useTip('snap');
  const close = () => (router.canGoBack() ? router.back() : router.replace('/feed'));

  if (isGuest) return <AccountGateView title="Snap" intent="snap" onBack={close} />;

  return (
    <CaptureView
      flashOn={flashOn}
      onToggleFlash={() => setFlashOn((value) => !value)}
      onClose={close}
      // Preview wiring: capture and estimation services are not built yet, so the shutter
      // opens the sample estimate.
      onCapture={() => {
        snapTip.done();
        router.push('/item/nike-neon-windbreaker?fresh=1');
      }}
      onOpenHistory={() => router.push('/history')}
    />
  );
}
