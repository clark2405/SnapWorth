import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { EstimateResultView, type EstimateStatus } from '@snapworth/shared/features/item';

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
    const timer = setTimeout(() => setStatus('estimated'), simulatedEstimateMs);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <EstimateResultView
      itemId={itemId}
      status={status}
      onBack={() => router.back()}
      onRetry={() => setStatus('estimating')}
      onPostToFeed={() => router.push(`/ask/${itemId ?? ''}`)}
      onListForSale={() => router.push(`/list/${itemId ?? ''}`)}
      onKeepPrivate={() => router.push('/history')}
    />
  );
}
