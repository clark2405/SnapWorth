import { useIsFocused, useRouter } from 'expo-router';

import { CameraCapture } from '../../src/camera/CameraCapture';

export default function CaptureRoute() {
  const router = useRouter();
  const focused = useIsFocused();

  return (
    <CameraCapture
      active={focused}
      onClose={() => router.navigate('/feed')}
      onOpenHistory={() => router.navigate('/history')}
    />
  );
}
