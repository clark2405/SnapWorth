import { useRouter } from 'expo-router';

import { AdminReviewView } from '@snapworth/shared/features/admin';

export default function AdminReviewRoute() {
  const router = useRouter();

  return (
    <AdminReviewView
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
    />
  );
}
