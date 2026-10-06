import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { EstimateResultView, type EstimateStatus } from '@snapworth/shared/features/item';

// Preview wiring: there is no estimation service yet, so a fresh capture simulates the wait.
const simulatedEstimateMs = 3200;

// The answer to a fresh snap, risen as a sheet over the frozen camera: half height shows the
// price and what to do next; drag it up for the rest. Swiping it away returns to the camera.
export default function SnapEstimateRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const itemId = Array.isArray(id) ? id[0] : id;
  const [status, setStatus] = useState<EstimateStatus>('estimating');

  useEffect(() => {
    if (status !== 'estimating') return;
    const timer = setTimeout(() => setStatus('estimated'), simulatedEstimateMs);
    return () => clearTimeout(timer);
  }, [status]);

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
