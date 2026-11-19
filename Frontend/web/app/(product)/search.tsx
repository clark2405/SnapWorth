import { useLocalSearchParams, useRouter } from 'expo-router';

import { SearchView, type SearchScope } from '@snapworth/shared/features/search';

// The website searches what's public; History is the phone app's.
const scopes: readonly SearchScope[] = ['all', 'market', 'feed'];

export default function SearchRoute() {
  const router = useRouter();
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  const initialScope = scopes.find((option) => option === scope) ?? 'all';

  return (
    <SearchView
      initialScope={initialScope}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/admin'))}
      onOpenResult={({ kind, id }) => {
        if (kind === 'listing') router.push(`/listing/${id}`);
        else if (kind === 'post') router.push(`/post/${id}`);
      }}
    />
  );
}
