import { useLocalSearchParams, useRouter } from 'expo-router';

import { SearchView, type SearchScope } from '@snapworth/shared/features/search';

const scopes: readonly SearchScope[] = ['all', 'market', 'feed', 'history'];

// The app's one place to search, as the tab bar's search tab: scopes narrow it to the market,
// the feed or your own history.
export default function SearchRoute() {
  const router = useRouter();
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  const initialScope = scopes.find((option) => option === scope) ?? 'all';

  return (
    <SearchView
      mode="tab"
      initialScope={initialScope}
      onOpenResult={({ kind, id }) => {
        if (kind === 'listing') router.push(`/listing/${id}`);
        else if (kind === 'post') router.push(`/post/${id}`);
        else router.push(`/item/${id}`);
      }}
    />
  );
}
