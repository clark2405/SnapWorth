import { ArrowLeft, Clock, SearchX, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import {
  AskingPriceBadge,
  Divider,
  EmptyState,
  EstimateBadge,
  hideWebFocusOutline,
  IconButton,
  Photo,
  PressableScale,
  Screen,
  SWText,
} from '../../components';
import { tokens } from '../../design';
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

export function SearchView({ initialScope = 'all', onBack, onOpenResult }: SearchViewProps) {
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

  const header = (
    <View style={styles.header}>
      <View style={styles.searchRow}>
        <IconButton icon={ArrowLeft} label="Go back" onPress={onBack} />
        <View style={styles.field}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder={`Search ${scope === 'all' ? 'SnapWorth' : scopes.find((s) => s.key === scope)?.label.toLowerCase()}`}
            placeholderTextColor={tokens.color.dark.textMuted}
            selectionColor={tokens.color.dark.accent}
            returnKeyType="search"
            autoCapitalize="none"
            accessibilityLabel="Search"
            style={[styles.input, hideWebFocusOutline]}
          />
          {query.length > 0 ? (
            <IconButton
              icon={X}
              label="Clear search"
              tone="textMuted"
              size={18}
              onPress={() => setQuery('')}
            />
          ) : null}
        </View>
      </View>
      <View style={styles.scopes} accessibilityRole="tablist">
        {scopes.map((option) => {
          const active = option.key === scope;
          return (
            <PressableScale
              key={option.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              onPress={() => setScope(option.key)}
              style={[styles.scope, active ? styles.scopeActive : null]}
            >
              <SWText variant="labelMedium" tone={active ? 'textPrimary' : 'textMuted'}>
                {option.label}
              </SWText>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );

  return (
    <Screen header={header} contentStyle={styles.content}>
      {trimmed.length === 0 ? (
        <View style={styles.recent}>
          <SWText variant="overline" tone="textMuted" accessibilityRole="header">
            Recent
          </SWText>
          {previewRecentSearches.map((recent) => (
            <PressableScale
              key={recent}
              accessibilityLabel={`Search for ${recent}`}
              onPress={() => setQuery(recent)}
              style={({ pressed }) => [styles.recentRow, pressed ? styles.pressed : null]}
            >
              <Clock size={18} strokeWidth={1.75} color={tokens.color.dark.textMuted} />
              <SWText variant="bodyMedium">{recent}</SWText>
            </PressableScale>
          ))}
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
          {results.map((result, index) => (
            <View key={`${result.kind}-${result.id}`}>
              {index > 0 ? <Divider /> : null}
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={`${kindLabel[result.kind]}: ${result.title}`}
                onPress={() => onOpenResult?.({ kind: result.kind, id: result.id })}
                style={({ pressed }) => [styles.result, pressed ? styles.pressed : null]}
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
              </PressableScale>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: tokens.spacing[3],
    paddingBottom: tokens.spacing[3],
    borderBottomWidth: tokens.border.hairline,
    borderBottomColor: tokens.color.dark.borderSubtle,
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
    minHeight: tokens.layout.inputHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: tokens.spacing[4],
    borderRadius: tokens.radius.medium,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.color.dark.borderStrong,
    backgroundColor: tokens.color.dark.sunken,
  },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    color: tokens.color.dark.textPrimary,
    fontFamily: tokens.typography.family.bodyRegular,
    fontSize: tokens.typography.style.bodyMedium.size,
  },
  scopes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.layout.pageGutterCompact,
  },
  scope: {
    minHeight: tokens.focus.minimumTarget - tokens.spacing[2],
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radius.full,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.color.dark.borderSubtle,
  },
  scopeActive: {
    backgroundColor: tokens.color.dark.surfaceRaised,
    borderColor: tokens.color.dark.borderStrong,
  },
  content: {
    paddingTop: tokens.spacing[4],
  },
  recent: {
    gap: tokens.spacing[1],
  },
  recentRow: {
    minHeight: tokens.layout.controlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    borderRadius: tokens.radius.medium,
  },
  pressed: {
    backgroundColor: tokens.color.dark.surface,
  },
  count: {
    marginBottom: tokens.spacing[2],
  },
  result: {
    flexDirection: 'row',
    gap: tokens.spacing[4],
    paddingVertical: tokens.spacing[4],
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
});
