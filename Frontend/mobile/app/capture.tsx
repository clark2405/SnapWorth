import { useIsFocused, useRouter } from 'expo-router';

import { AccountGateView, useSession } from '@snapworth/shared/features/session';
import { useTip } from '@snapworth/shared/features/tips';
import { usePhotoPricing } from '@snapworth/shared/composition';

import { CameraCapture } from '../src/camera/CameraCapture';

// The camera is an action, not a place: it opens full screen over whatever screen asked for it
// and closes back to it, instead of living in the tab bar.
export default function CaptureRoute() {
  const router = useRouter();
  const focused = useIsFocused();
  const pricing = usePhotoPricing();
  const { isGuest } = useSession();
  // Taking a photo is what the Snap tip teaches, so doing it retires the tip.
  const snapTip = useTip('snap');
  const close = () => (router.canGoBack() ? router.back() : router.replace('/feed'));

  if (isGuest) return <AccountGateView title="Snap" intent="snap" onBack={close} />;

  return (
    <CameraCapture
      active={focused}
      onClose={close}
      onPhotoCaptured={snapTip.done}
      onEstimate={pricing.estimate}
      onOpenHistory={() => router.dismissTo('/history')}
    />
  );
}
