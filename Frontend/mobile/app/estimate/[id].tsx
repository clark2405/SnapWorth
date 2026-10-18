import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { EstimateResultView, type EstimateStatus } from '@snapworth/shared/features/item';

import { cancelNotification, scheduleNotification } from '../../src/notifications';

// Preview wiring: there is no estimation service yet, so a fresh capture simulates the wait.
const simulatedEstimateMs = 3200;

const estimateReady = (itemId: string | undefined) => ({
  title: 'Your estimate is ready',
  body: 'See what your snap is worth and decide what to do with it.',
  path: `/item/${itemId ?? ''}`,
});

// The answer to a fresh snap, risen as a sheet over the frozen camera: half height shows the
// price and what to do next; drag it up for the rest. Swiping it away returns to the camera.
export default function SnapEstimateRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const itemId = Array.isArray(id) ? id[0] : id;
  const [status, setStatus] = useState<EstimateStatus>('estimating');

  useEffect(() => {
    if (status !== 'estimating') return;
    const started = Date.now();
    let scheduled: Promise<string | null> | null = null;
    // Leaving mid-estimate lines up an "it's ready" notification for when it would finish, since
    // the app stops running in the background; coming back first withdraws it.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' && !scheduled) {
        const left = (simulatedEstimateMs - (Date.now() - started)) / 1000;
        scheduled = scheduleNotification('estimates', estimateReady(itemId), left);
      } else if (state === 'active' && scheduled) {
        void scheduled.then(cancelNotification);
        scheduled = null;
      }
    });
    const timer = setTimeout(() => setStatus('estimated'), simulatedEstimateMs);
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [itemId, status]);

  return (
    <EstimateResultView
      presentation="sheet"
      itemId={itemId}
      status={status}
      onRetry={() => setStatus('estimating')}
      onPostToFeed={(source) =>
        router.push(`/ask/${itemId ?? ''}${source === 'listing' ? '?from=listing' : ''}`)
      }
      onListForSale={() => router.push(`/list/${itemId ?? ''}`)}
      onKeepPrivate={() => router.dismissTo('/history')}
      onViewPost={(postId) => router.push(`/post/${postId}`)}
      onViewListing={(listingId) => router.push(`/listing/${listingId}`)}
    />
  );
}
