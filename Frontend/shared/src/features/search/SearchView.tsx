import { ArrowUpLeft, Clock, Search, SearchX, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  EmptyState,
  hideWebFocusOutline,
  Photo,
  PressableScale,
  Screen,
  ScrollEdge,
  SWText,
  typeStyle,
  ZoomLink,
  type SearchOrigin,
} from '../../components';
import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import {
  formatPeso,
  previewRecentSearches,
  previewSearchIndex,
  previewTrending,
  type PreviewSearchResult,
} from '../preview/sample-data';

export type SearchScope = 'all' | 'market' | 'feed' | 'history';

export interface SearchViewProps {
  readonly initialScope?: SearchScope;
  /** The search button's frame; the field starts as that button and stretches out from it. */
  readonly origin?: SearchOrigin;
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

/** What a trending tile searches for; categories are broader than any one title. */
const trendingQuery: Record<string, string> = {
  'film-cameras': 'Polaroid',
  sneakers: 'Jordan',
  '90s-sportswear': 'Windbreaker',
  'retro-audio': 'Walkman',
  keyboards: 'Keyboard',
};

const fieldHeight = 44;
/** The keyboard waits for the field to finish stretching, so the two never race. */
const focusDelayMs = 380;
/** Heavier than the house springs: the field travels far, and should land without a wobble. */
const stretch = { damping: 24, stiffness: 190, mass: 1 } as const;
const settle = Easing.bezier(0.4, 0, 0.2, 1);

function hrefFor(result: PreviewSearchResult): string {
  if (result.kind === 'listing') return `/listing/${result.id}`;
  if (result.kind === 'post') return `/post/${result.id}`;
  return `/item/${result.id}`;
}

/**
 * Search opens out of the search button. The field starts as that exact circle, then rises into
 * the bar and stretches out sideways while the page fades in behind it; Cancel and the scopes
 * follow, and the keyboard rises once it has landed. Cancel plays it backwards, folding the
 * field back into the button. Empty, it offers recent terms and what is trending; typing
 * narrows results in place, with the match marked.
 */
export function SearchView({
  initialScope = 'all',
  origin,
  onBack,
  onOpenResult,
}: SearchViewProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const input = useRef<TextInput>(null);
  const slotRef = useRef<View>(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>(initialScope);
  const [recents, setRecents] = useState<readonly string[]>(previewRecentSearches);
  // The field's resting frame in window coordinates, measured so it can start on the button.
  const [slot, setSlot] = useState<SearchOrigin | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  // 0: sitting on the search button. 1: the full bar, page faded in.
  const morph = useSharedValue(reduceMotion ? 1 : 0);
  const ready = slot !== null;
  const trimmed = query.trim().toLowerCase();

  useEffect(() => {
    if (!ready) return;
    if (!reduceMotion) morph.value = withSpring(1, stretch);
    const timer = setTimeout(() => input.current?.focus(), reduceMotion ? 0 : focusDelayMs);
    return () => clearTimeout(timer);
  }, [morph, ready, reduceMotion]);

  const measureSlot = () =>
    slotRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0) setSlot({ x, y, width, height });
    });

  // Without a button to start from (a deep link, the web), the field grows from its right end.
  const start: SearchOrigin | null =
    origin ??
    (slot
      ? {
          x: slot.x + slot.width - fieldHeight,
          y: slot.y + (slot.height - fieldHeight) / 2,
          width: fieldHeight,
          height: fieldHeight,
        }
      : null);

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

  const capsuleStyle = useAnimatedStyle(() => {
    if (!slot || !start) return { width: '100%', opacity: 0 };
    const m = morph.value;
    // The capsule is right-aligned in its slot, so it stretches out to the left of the button.
    const restLeft = slot.x + slot.width - start.width;
    const dx = start.x - restLeft;
    const dy = start.y + start.height / 2 - (slot.y + slot.height / 2);
    return {
      opacity: 1,
      width: interpolate(m, [0, 1], [start.width, slot.width]),
      transform: [{ translateX: dx * (1 - m) }, { translateY: dy * (1 - m) }],
    };
  });
  const innerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0.5, 1], [0, 1], 'clamp'),
  }));
  // The button's darker glyph hands over to the field's quieter one as it stretches.
  const glyphStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0, 0.5], [1, 0], 'clamp'),
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0, 0.6], [0, 1], 'clamp'),
  }));
  const cancelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0.4, 1], [0, 1], 'clamp'),
    transform: [{ translateX: (1 - morph.value) * tokens.spacing[8] }],
  }));
  const followStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0.45, 1], [0, 1], 'clamp'),
    transform: [{ translateY: (1 - morph.value) * tokens.spacing[3] }],
  }));

  const leave = () => {
    Keyboard.dismiss();
    if (reduceMotion || !ready) {
      onBack?.();
      return;
    }
    const finish = () => onBack?.();
    morph.value = withTiming(0, { duration: 320, easing: settle }, (done) => {
      if (done) runOnJS(finish)();
    });
  };

  const header = (
    <View
      style={styles.header}
      onLayout={(event: LayoutChangeEvent) => setHeaderHeight(event.nativeEvent.layout.height)}
    >
      {headerHeight > 0 ? (
        <Animated.View style={[styles.edge, { top: -insets.top }, backdropStyle]}>
          <ScrollEdge solid={insets.top + headerHeight} />
        </Animated.View>
      ) : null}
      <View style={styles.searchRow}>
        <View ref={slotRef} collapsable={false} style={styles.slot} onLayout={measureSlot}>
          <Animated.View style={[styles.capsule, capsuleStyle]}>
            <View>
              <Search size={17} strokeWidth={2.2} color={colors.textMuted} />
              <Animated.View style={[styles.glyph, glyphStyle]}>
                <Search size={20} strokeWidth={2} color={colors.textPrimary} />
              </Animated.View>
            </View>
            <Animated.View style={[styles.inputWrap, innerStyle]}>
              <TextInput
                ref={input}
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${scope === 'all' ? 'SnapWorth' : scopeLabel}`}
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.accent}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Search"
                style={[
                  styles.input,
                  typeStyle('bodyLarge'),
                  { color: colors.textPrimary, lineHeight: undefined },
                  hideWebFocusOutline,
                ]}
              />
            </Animated.View>
            {query.length > 0 ? (
              <Animated.View
                entering={reduceMotion ? undefined : ZoomIn.springify().damping(16)}
                exiting={reduceMotion ? undefined : ZoomOut.duration(120)}
              >
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  haptic="tap"
                  hitSlop={tokens.spacing[2]}
                  onPress={() => {
                    setQuery('');
                    input.current?.focus();
                  }}
                  style={styles.clear}
                >
                  <X size={11} strokeWidth={3} color={colors.canvas} />
                </PressableScale>
              </Animated.View>
            ) : null}
          </Animated.View>
        </View>
        <Animated.View style={cancelStyle}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Cancel search"
            haptic="none"
            hitSlop={tokens.spacing[2]}
            onPress={leave}
            style={styles.cancel}
          >
            <SWText variant="label" tone="accent">
              Cancel
            </SWText>
          </PressableScale>
        </Animated.View>
      </View>

      <Animated.View style={followStyle}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.pills}
          accessibilityRole="tablist"
        >
          {scopes.map((option) => {
            const active = option.key === scope;
            return (
              <PressableScale
                key={option.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={option.label}
                haptic="none"
                onPress={() => {
                  if (active) return;
                  haptic('select');
                  setScope(option.key);
                }}
                style={[styles.pill, active ? styles.pillActive : null]}
              >
                <SWText variant="labelSmall" tone={active ? 'onInverse' : 'textSecondary'}>
                  {option.label}
                </SWText>
              </PressableScale>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <Screen transparent header={header} contentStyle={styles.content}>
        <Animated.View style={followStyle}>
          {trimmed.length === 0 ? (
            <View style={styles.sections}>
              {recents.length > 0 ? (
                <View style={styles.section}>
                  <View style={styles.sectionHead}>
                    <SWText variant="headingMedium" accessibilityRole="header">
                      Recent
                    </SWText>
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel="Clear recent searches"
                      haptic="tap"
                      hitSlop={tokens.spacing[2]}
                      onPress={() => setRecents([])}
                    >
                      <SWText variant="label" tone="accent">
                        Clear
                      </SWText>
                    </PressableScale>
                  </View>
                  <View>
                    {recents.map((term, index) => (
                      <Animated.View
                        key={term}
                        exiting={reduceMotion ? undefined : FadeOut.duration(160)}
                        layout={reduceMotion ? undefined : LinearTransition.springify().damping(20)}
                      >
                        <PressableScale
                          accessibilityRole="button"
                          accessibilityLabel={`Search for ${term}`}
                          haptic="none"
                          depth="surface"
                          onPress={() => setQuery(term)}
                          style={({ pressed }) => [
                            styles.recentRow,
                            index > 0 ? styles.divided : null,
                            pressed ? styles.rowPressed : null,
                          ]}
                        >
                          <Clock size={17} strokeWidth={2} color={colors.textMuted} />
                          <SWText variant="bodyLarge" style={styles.flex} numberOfLines={1}>
                            {term}
                          </SWText>
                          <ArrowUpLeft size={17} strokeWidth={2} color={colors.textMuted} />
                        </PressableScale>
                      </Animated.View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.section}>
                <SWText variant="headingMedium" accessibilityRole="header">
                  Trending
                </SWText>
                <View style={styles.grid}>
                  {previewTrending.slice(0, 4).map((trend) => {
                    const falling = trend.change.startsWith('−');
                    return (
                      <PressableScale
                        key={trend.key}
                        accessibilityRole="button"
                        accessibilityLabel={`${trend.label}, ${trend.change} this month`}
                        haptic="none"
                        depth="surface"
                        onPress={() => setQuery(trendingQuery[trend.key] ?? trend.label)}
                        containerStyle={styles.tileSlot}
                        style={styles.tile}
                      >
                        <Photo
                          source={trend.photo}
                          label={trend.label}
                          radius={tokens.radius.large}
                          style={styles.tilePhoto}
                        />
                        <View style={styles.tileText}>
                          <SWText variant="headingSmall" numberOfLines={1}>
                            {trend.label}
                          </SWText>
                          <SWText variant="labelSmall" tone={falling ? 'danger' : 'success'}>
                            {trend.change}
                          </SWText>
                        </View>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : results.length === 0 ? (
            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(200)}>
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
            </Animated.View>
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
                <Animated.View
                  key={`${result.kind}-${result.id}`}
                  entering={reduceMotion ? undefined : FadeIn.duration(220)}
                  exiting={reduceMotion ? undefined : FadeOut.duration(140)}
                  layout={reduceMotion ? undefined : LinearTransition.springify().damping(20)}
                >
                  <ZoomLink
                    href={hrefFor(result)}
                    label={`${kindLabel[result.kind]}: ${result.title}`}
                    onPress={() => {
                      Keyboard.dismiss();
                      onOpenResult?.({ kind: result.kind, id: result.id });
                    }}
                    style={[styles.result, index > 0 ? styles.divided : null]}
                  >
                    <Photo
                      source={result.photo}
                      label={result.photoLabel}
                      radius={tokens.radius.medium}
                      style={styles.thumb}
                    />
                    <View style={styles.flex}>
                      <Highlighted text={result.title} match={trimmed} />
                      <SWText variant="caption" tone="textMuted">
                        {kindLabel[result.kind]}
                      </SWText>
                    </View>
                    <View style={styles.amount}>
                      <SWText variant="priceSmall">{formatPeso(result.amount)}</SWText>
                      <SWText
                        variant="caption"
                        tone={result.kind === 'listing' ? 'textMuted' : 'accent'}
                      >
                        {result.kind === 'listing' ? 'Asking' : 'AI estimate'}
                      </SWText>
                    </View>
                  </ZoomLink>
                </Animated.View>
              ))}
            </View>
          )}
        </Animated.View>
      </Screen>
    </View>
  );
}

/** The title with the typed text picked out, so it is clear why each result matched. */
function Highlighted({ text, match }: { readonly text: string; readonly match: string }) {
  const start = text.toLowerCase().indexOf(match);
  if (start < 0 || match.length === 0) {
    return (
      <SWText variant="headingSmall" numberOfLines={2}>
        {text}
      </SWText>
    );
  }
  const end = start + match.length;
  return (
    <SWText variant="headingSmall" tone="textSecondary" numberOfLines={2}>
      {text.slice(0, start)}
      <SWText variant="headingSmall" tone="textPrimary">
        {text.slice(start, end)}
      </SWText>
      {text.slice(end)}
    </SWText>
  );
}

const gutter = tokens.layout.pageGutterCompact;

const stylesFor = themedStyles((colors) => ({
  root: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: colors.canvas,
  },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  glyph: {
    position: 'absolute',
    top: -1.5,
    left: -1.5,
  },
  header: {
    paddingTop: tokens.spacing[2],
    paddingBottom: tokens.spacing[3],
    gap: tokens.spacing[3],
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingHorizontal: gutter,
  },
  slot: {
    flex: 1,
    alignItems: 'flex-end',
  },
  capsule: {
    height: fieldHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingLeft: tokens.spacing[3] + 1,
    paddingRight: tokens.spacing[3],
    borderRadius: tokens.radius.full,
    backgroundColor: colors.sunken,
    overflow: 'hidden',
  },
  inputWrap: {
    flex: 1,
  },
  input: {
    height: fieldHeight,
    padding: 0,
  },
  clear: {
    width: 18,
    height: 18,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textMuted,
  },
  cancel: {
    paddingVertical: tokens.spacing[2],
  },
  pills: {
    gap: tokens.spacing[2],
    paddingHorizontal: gutter,
  },
  pill: {
    height: 34,
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
  pillActive: {
    backgroundColor: colors.inverse,
  },
  content: {
    paddingTop: tokens.spacing[2],
  },
  sections: {
    gap: tokens.spacing[8],
  },
  section: {
    gap: tokens.spacing[3],
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    minHeight: tokens.layout.controlMinimum + 4,
    borderRadius: tokens.radius.small,
  },
  rowPressed: {
    backgroundColor: colors.sunken,
  },
  divided: {
    borderTopWidth: tokens.border.hairline,
    borderTopColor: colors.borderSubtle,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[3],
  },
  tileSlot: {
    width: '48%',
    flexGrow: 1,
  },
  tile: {
    gap: tokens.spacing[2],
  },
  tilePhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  tileText: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.spacing[2],
  },
  count: {
    marginBottom: tokens.spacing[1],
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
  },
  thumb: {
    width: 56,
    height: 56,
  },
  amount: {
    alignItems: 'flex-end',
    gap: 2,
  },
}));
