import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { EstimateResultView, type EstimateStatus } from '@snapworth/shared/features/item';

import { notify } from '../../../src/notifications';

// Preview wiring: there is no estimation service yet, so a fresh capture simulates the wait.
const simulatedEstimateMs = 3200;

export default function ItemDetailRoute() {
  const router = useRouter();
  const { id, fresh } = useLocalSearchParams<{ id?: string | string[]; fresh?: string }>();
  const itemId = Array.isArray(id) ? id[0] : id;
  // `?fresh=1` simulates a new capture; `?fresh=failed` and `?fresh=offline` preview those states.
  const [status, setStatus] = useState<EstimateStatus>(
    fresh === '1' ? 'estimating' : fresh === 'failed' || fresh === 'offline' ? fresh : 'estimated',
  );

  useEffect(() => {
    if (status !== 'estimating') return;
    const timer = setTimeout(() => {
      setStatus('estimated');
      // If they moved to another tab while it was valuing, tell them it's done.
      notify(
        'estimates',
        {
          title: 'Your estimate is ready',
          body: 'See what your snap is worth and decide what to do with it.',
          path: `/item/${itemId ?? ''}`,
        },
        (path) => router.push(path as Href),
      );
    }, simulatedEstimateMs);
    return () => clearTimeout(timer);
  }, [itemId, router, status]);

  return (
    <EstimateResultView
      itemId={itemId}
      status={status}
      onBack={() => router.back()}
      onRetry={() => setStatus('estimating')}
      onPostToFeed={(source) =>
        router.push(`/ask/${itemId ?? ''}${source === 'listing' ? '?from=listing' : ''}`)
      }
      onListForSale={() => router.push(`/list/${itemId ?? ''}`)}
      onKeepPrivate={() => router.push('/history')}
      onViewPost={(postId) => router.push(`/post/${postId}`)}
      onViewListing={(listingId) => router.push(`/listing/${listingId}`)}
    />
  );
}
