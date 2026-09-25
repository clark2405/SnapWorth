import { ArrowLeft, Search, SearchX, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';

import {
  AskingPriceBadge,
  EmptyState,
  GlassSurface,
  EstimateBadge,
  ChoiceChips,
  IconButton,
  Photo,
  Screen,
  SegmentedControl,
  SWText,
  TextField,
  ZoomLink,
} from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import {
  formatPeso,
  previewRecentSearches,
  previewSearchIndex,
  type PreviewSearchResult,
} from '../preview/sample-data';

export type SearchScope = 'all' | 'market' | 'feed' | 'history';

export interface SearchViewProps {
  readonly initialScope?: SearchScope;
  readonly onBack?: () => void;
  readonly onOpenResult?: (result: { kind: PreviewSearchResult['kind']; id: string }) => void;
}

const scopes: readonly { key: SearchScope; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'market', label: 'Market' },
  { key: 'feed', label: 'Feed' },
  { key: 'history', label: 'History' },
];

const scopeKinds: Record<SearchScope, readonly PreviewSearchResult['kind'][]> = {
  all: ['listing', 'post', 'item'],
  market: ['listing'],
  feed: ['post'],
  history: ['item'],
};

const kindLabel: Record<PreviewSearchResult['kind'], string> = {
  listing: 'Listing',
  post: 'Feed post',
  item: 'Your history',
};

function hrefFor(result: PreviewSearchResult): string {
  if (result.kind === 'listing') return `/listing/${result.id}`;
  if (result.kind === 'post') return `/post/${result.id}`;
  return `/item/${result.id}`;
}

/**
 * One field, one scope, and a list that never jumps: results fade and reflow as the query
 * changes instead of the page flashing, and recent terms are a tap away when the field is empty.
 */
export function SearchView({ initialScope = 'all', onBack, onOpenResult }: SearchViewProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>(initialScope);
  const trimmed = query.trim().toLowerCase();

  const results = useMemo(
    () =>
      trimmed.length === 0
        ? []
        : previewSearchIndex.filter(
            (result) =>
              scopeKinds[scope].includes(result.kind) &&
              result.title.toLowerCase().includes(trimmed),
          ),
    [scope, trimmed],
  );

  const scopeLabel = scopes.find((option) => option.key === scope)?.label.toLowerCase();

  const header = (
    <GlassSurface style={[styles.header, styles.headerGlass]}>
      <View style={styles.searchRow}>
        <IconButton icon={ArrowLeft} label="Go back" onPress={onBack} />
        <View style={styles.field}>
          <TextField
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder={`Search ${scope === 'all' ? 'SnapWorth' : scopeLabel}`}
            returnKeyType="search"
            autoCapitalize="none"
            accessibilityLabel="Search"
            leading={<Search size={18} strokeWidth={2} color={colors.textMuted} />}
          />
        </View>
        {query.length > 0 ? (
          <Animated.View entering={ZoomIn.springify().damping(14)} exiting={ZoomOut.duration(120)}>
            <IconButton
              icon={X}
              label="Clear search"
              tone="textMuted"
              size={18}
              onPress={() => setQuery('')}
            />
          </Animated.View>
        ) : null}
      </View>
      <View style={styles.scopes}>
        <SegmentedControl options={scopes} value={scope} onChange={setScope} />
      </View>
    </GlassSurface>
  );

  return (
    <Screen header={header} contentStyle={styles.content}>
      {trimmed.length === 0 ? (
        <View style={styles.recent}>
          <SWText variant="overline" tone="textMuted" accessibilityRole="header">
            Recent
          </SWText>
          <ChoiceChips
            options={previewRecentSearches.map((term) => ({ key: term, label: term }))}
            value={null}
            onChange={setQuery}
          />
        </View>
      ) : results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={`No matches for “${query.trim()}”`}
          body={
            scope === 'all'
              ? 'Try a shorter word, or a brand or item type.'
              : 'Nothing here matches. Try searching everything instead.'
          }
          actionLabel={scope === 'all' ? 'Clear search' : 'Search everything'}
          onAction={() => (scope === 'all' ? setQuery('') : setScope('all'))}
        />
      ) : (
        <View>
          <SWText
            variant="caption"
            tone="textMuted"
            accessibilityLiveRegion="polite"
            style={styles.count}
          >
            {`${results.length} ${results.length === 1 ? 'result' : 'results'}`}
          </SWText>
          <View style={styles.results}>
            {results.map((result) => (
              <Animated.View
                key={`${result.kind}-${result.id}`}
                entering={FadeIn.duration(220)}
                exiting={FadeOut.duration(160)}
                layout={LinearTransition.springify().damping(20)}
              >
                <ZoomLink
                  href={hrefFor(result)}
                  label={`${kindLabel[result.kind]}: ${result.title}`}
                  onPress={() => onOpenResult?.({ kind: result.kind, id: result.id })}
                  style={styles.result}
                >
                  <Photo
                    source={result.photo}
                    label={result.photoLabel}
                    radius={tokens.radius.medium}
                    style={styles.thumb}
                  />
                  <View style={styles.resultText}>
                    <SWText variant="overline" tone="textMuted">
                      {kindLabel[result.kind]}
                    </SWText>
                    <SWText variant="headingSmall" numberOfLines={2}>
                      {result.title}
                    </SWText>
                    {result.kind === 'listing' ? (
                      <AskingPriceBadge value={formatPeso(result.amount)} size="compact" />
                    ) : (
                      <EstimateBadge value={formatPeso(result.amount)} />
                    )}
                  </View>
                </ZoomLink>
              </Animated.View>
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}

const stylesFor = themedStyles(() => ({
  header: {
    gap: tokens.spacing[3],
    paddingBottom: tokens.spacing[3],
  },
  headerGlass: {
    borderWidth: 0,
  },
  scopes: {
    paddingHorizontal: tokens.layout.pageGutterCompact,
    paddingBottom: tokens.spacing[3],
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
    paddingLeft: tokens.spacing[2],
    paddingRight: tokens.layout.pageGutterCompact,
    paddingTop: tokens.spacing[2],
  },
  field: {
    flex: 1,
  },
  content: {
    paddingTop: tokens.spacing[4],
  },
  recent: {
    gap: tokens.spacing[3],
  },
  count: {
    marginBottom: tokens.spacing[2],
  },
  results: {
    gap: tokens.spacing[2],
  },
  result: {
    flexDirection: 'row',
    gap: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
    borderRadius: tokens.radius.medium,
  },
  thumb: {
    width: tokens.layout.thumbnail,
    height: tokens.layout.thumbnail,
  },
  resultText: {
    flex: 1,
    gap: tokens.spacing[2],
  },
}));
