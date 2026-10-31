import { MapPin, Search, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Divider, PressableScale, SWText, TextField, paperIn } from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import { matchingSpots, placeSearchCredit, searchPlaces, type FoundPlace } from './place-search';

/** The most results shown at once, so the map stays in view. */
const shownResults = 5;

/**
 * Finds a place to meet by name instead of dragging the map there. The suggested meetup spots
 * match as you type; pressing search looks the name up (see `place-search.ts`). Picking a result
 * moves the map there, where the pin can still be nudged.
 */
export function PlaceSearch({ onPick }: { readonly onPick: (place: FoundPlace) => void }) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{
    readonly query: string;
    readonly places: readonly FoundPlace[];
  } | null>(null);
  const [state, setState] = useState<'idle' | 'searching' | 'failed'>('idle');
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  const text = query.trim();
  const spots = matchingSpots(text);
  // Looked-up places that aren't already a suggested spot, after the spots themselves.
  const looked = (found?.query === text ? found.places : []).filter(
    (place) => !spots.some((spot) => spot.name === place.name),
  );
  const results = [...spots, ...looked].slice(0, shownResults);

  const search = async () => {
    if (text.length < 2) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState('searching');
    const places = await searchPlaces(text, controller.signal);
    if (controller.signal.aborted) return;
    if (places === null) {
      setState('failed');
      return;
    }
    setFound({ query: text, places });
    setState('idle');
  };

  const pick = (place: FoundPlace) => {
    Keyboard.dismiss();
    request.current?.abort();
    setQuery('');
    setFound(null);
    setState('idle');
    onPick(place);
  };

  const searchedNothing =
    state === 'idle' && found?.query === text && text.length > 0 && results.length === 0;

  return (
    <View style={styles.wrap}>
      <TextField
        value={query}
        onChangeText={(next) => {
          setQuery(next);
          if (state === 'failed') setState('idle');
        }}
        onSubmitEditing={() => void search()}
        placeholder="Search a place, e.g. Ayala Center"
        accessibilityLabel="Search for a place to meet"
        returnKeyType="search"
        autoCorrect={false}
        leading={<Search size={18} strokeWidth={1.75} color={colors.textMuted} />}
        trailing={
          query ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={tokens.spacing[2]}
              onPress={() => {
                setQuery('');
                setFound(null);
                setState('idle');
              }}
            >
              <X size={18} strokeWidth={1.75} color={colors.textMuted} />
            </PressableScale>
          ) : null
        }
      />
      {results.length > 0 ? (
        <Animated.View entering={paperIn(0, 6)} style={styles.results}>
          {results.map((place, index) => (
            <View key={`${place.name}-${place.lat}-${place.lng}`}>
              {index > 0 ? <Divider style={styles.divider} /> : null}
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${place.name}${place.detail ? `, ${place.detail}` : ''}. Move the map here`}
                onPress={() => pick(place)}
                style={styles.row}
              >
                <MapPin
                  size={18}
                  strokeWidth={1.75}
                  color={place.spotKey ? colors.accent : colors.textSecondary}
                />
                <View style={styles.rowText}>
                  <SWText variant="label" numberOfLines={1}>
                    {place.name}
                  </SWText>
                  {place.detail || place.spotKey ? (
                    <SWText variant="caption" tone="textMuted" numberOfLines={1}>
                      {place.spotKey ? `Suggested meetup spot · ${place.detail}` : place.detail}
                    </SWText>
                  ) : null}
                </View>
              </PressableScale>
            </View>
          ))}
        </Animated.View>
      ) : null}
      {text.length >= 2 && state === 'idle' && found?.query !== text ? (
        <SWText variant="caption" tone="textMuted">
          Press search to look further than the suggested spots.
        </SWText>
      ) : null}
      {state === 'searching' ? (
        <SWText variant="caption" tone="textMuted" accessibilityLiveRegion="polite">
          Looking…
        </SWText>
      ) : null}
      {state === 'failed' ? (
        <SWText variant="caption" tone="textMuted" accessibilityLiveRegion="polite">
          Couldn’t search right now. Try again, or drag the map to the spot.
        </SWText>
      ) : null}
      {searchedNothing ? (
        <SWText variant="caption" tone="textMuted" accessibilityLiveRegion="polite">
          {`Nothing found for “${text}”. Try a nearby landmark, or drag the map.`}
        </SWText>
      ) : null}
      {looked.length > 0 && placeSearchCredit ? (
        <SWText variant="caption" tone="textMuted" style={styles.credit}>
          {placeSearchCredit}
        </SWText>
      ) : null}
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  wrap: {
    gap: tokens.spacing[2],
  },
  results: {
    borderRadius: tokens.radius.medium,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    paddingHorizontal: tokens.spacing[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingVertical: tokens.spacing[2] + 2,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  divider: {
    marginLeft: 18 + tokens.spacing[3],
  },
  credit: {
    alignSelf: 'flex-end',
  },
}));
