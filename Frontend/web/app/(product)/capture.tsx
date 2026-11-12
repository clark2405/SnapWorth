import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Camera } from 'lucide-react-native';

import { EmptyState, NavHeader, Screen } from '@snapworth/shared/components';
import { CaptureView } from '@snapworth/shared/features/capture';
import { AccountGateView, useBackendMode, useSession } from '@snapworth/shared/features/session';
import { useTip } from '@snapworth/shared/features/tips';

export default function CaptureRoute() {
  const router = useRouter();
  const [flashOn, setFlashOn] = useState(false);
  const { isGuest } = useSession();
  // Taking a photo is what the Snap tip teaches, so doing it retires the tip.
  const snapTip = useTip('snap');
  const close = () => (router.canGoBack() ? router.back() : router.replace('/feed'));

  const backend = useBackendMode();

  if (isGuest) return <AccountGateView title="Snap" intent="snap" onBack={close} />;

  // The web has no camera yet, and its shutter only opens a sample estimate. With a real
  // account that would be somebody else's numbers, so say where Snap works instead.
  if (backend === 'supabase') {
    return (
      <Screen header={<NavHeader title="Snap" onBack={close} />}>
        <EmptyState
          icon={Camera}
          title="Snap from the phone app"
          body="The website can't take a photo yet. Open SnapWorth on your phone to snap an item; it appears in History here once it's valued."
          actionLabel="Open your history"
          onAction={() => router.push('/history')}
        />
      </Screen>
    );
  }

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
