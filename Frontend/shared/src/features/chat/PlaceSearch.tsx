import { MapPin, Search, X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Divider, PressableScale, SWText, TextField } from '../../components';
import { held, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import {
  matchingSpots,
  placeSearchCredit,
  placeSearchEndpoint,
  searchMinLetters,
  searchPauseMs,
  searchPlaces,
  type FoundPlace,
} from './place-search';

/** The most places listed at once. */
const shownResults = 8;

/**
 * Finds a place to meet by name instead of dragging the map there. The suggested meetup spots
 * match at once; after a pause in typing the name is looked up too (see `place-search.ts`),
 * nearest the map's middle first. Picking a place moves the map there, where the pin can still
 * be nudged.
 *
 * The places drop down over the map (`children`) rather than pushing it down: the space the
 * search takes never changes as you type, so the sheet it sits in, and the keyboard with it,
 * stay still.
 */
export function PlaceSearch({
  onPick,
  near,
  fill = false,
  children,
}: {
  readonly onPick: (place: FoundPlace) => void;
  /** Where to look first: the map's middle. */
  readonly near?: { readonly lat: number; readonly lng: number };
  /** The map fills the space left (the full-screen map) rather than keeping its own shape. */
  readonly fill?: boolean;
  /** The map the places drop down over. */
  readonly children: ReactNode;
}) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<{
    readonly query: string;
    readonly places: readonly FoundPlace[];
  } | null>(null);
  const [state, setState] = useState<'idle' | 'searching' | 'failed'>('idle');
  const [areaHeight, setAreaHeight] = useState(0);
  const request = useRef<AbortController | null>(null);
  const nearRef = useRef(near);
  nearRef.current = near;

  const text = query.trim();

  const search = async (words: string) => {
    request.current?.abort();
    if (words.length < 2 || !placeSearchEndpoint) return;
    const controller = new AbortController();
    request.current = controller;
    setState('searching');
    const places = await searchPlaces(words, controller.signal, nearRef.current);
    if (controller.signal.aborted) return;
    if (places === null) {
      setState('failed');
      return;
    }
    setFound({ query: words, places });
    setState('idle');
  };

  // A pause in typing looks the name up; another letter before then starts the wait again.
  useEffect(() => {
    if (text.length < searchMinLetters || found?.query === text) return;
    const timer = setTimeout(() => void search(text), searchPauseMs);
    return () => clearTimeout(timer);
    // `search` is recreated each render; the words typed are what decide a new lookup.
  }, [text]);

  useEffect(() => () => request.current?.abort(), []);

  const spots = matchingSpots(text);
  // Looked-up places that aren't already a suggested spot, after the spots themselves. The last
  // lookup's places stay while the next is on its way, so the list doesn't blink.
  const looked = (found && text.startsWith(found.query.slice(0, 2)) ? found.places : []).filter(
    (place) => !spots.some((spot) => spot.name === place.name),
  );
  const results = [...spots, ...looked].slice(0, shownResults);

  const clear = () => {
    request.current?.abort();
    setQuery('');
    setFound(null);
    setState('idle');
    setOpen(false);
  };

  const pick = (place: FoundPlace) => {
    Keyboard.dismiss();
    clear();
    onPick(place);
  };

  const searchedNothing =
    state === 'idle' && found?.query === text && text.length > 0 && results.length === 0;
  const note =
    state === 'searching'
      ? 'Looking…'
      : state === 'failed'
        ? 'Couldn’t search right now. Try again, or drag the map to the spot.'
        : searchedNothing
          ? `Nothing found for “${text}”. Try a nearby landmark, or drag the map.`
          : text.length > 0 && text.length < searchMinLetters && results.length === 0
            ? 'Keep typing…'
            : null;
  const showing = open && text.length > 0 && (results.length > 0 || note !== null);

  return (
    <View style={[styles.wrap, fill ? styles.fill : null]}>
      <TextField
        value={query}
        onChangeText={(next) => {
          setQuery(next);
          setOpen(true);
          if (state === 'failed') setState('idle');
        }}
        onFocus={() => setOpen(true)}
        // Leaving the field (tapping the map) closes the list; a tap on a place lands first.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onSubmitEditing={() => void search(text)}
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
              onPress={clear}
            >
              <X size={18} strokeWidth={1.75} color={colors.textMuted} />
            </PressableScale>
          ) : null
        }
      />
      <View
        style={fill ? styles.fill : null}
        onLayout={(event) => setAreaHeight(event.nativeEvent.layout.height)}
      >
        {children}
        {showing ? (
          <Animated.View
            entering={FadeIn.duration(tokens.motion.duration.fast)}
            exiting={FadeOut.duration(tokens.motion.duration.fast)}
            style={[
              styles.dropdown,
              held(colors, 3),
              areaHeight > 0 ? { maxHeight: areaHeight - tokens.spacing[2] } : null,
            ]}
          >
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
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
              {note ? (
                <SWText
                  variant="caption"
                  tone="textMuted"
                  accessibilityLiveRegion="polite"
                  style={styles.note}
                >
                  {note}
                </SWText>
              ) : null}
              {looked.length > 0 && placeSearchCredit ? (
                <SWText variant="caption" tone="textMuted" style={styles.credit}>
                  {placeSearchCredit}
                </SWText>
              ) : null}
            </ScrollView>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  wrap: {
    gap: tokens.spacing[2],
  },
  fill: {
    flex: 1,
  },
  dropdown: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderRadius: tokens.radius.medium,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    paddingHorizontal: tokens.spacing[3],
    overflow: 'hidden',
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
  note: {
    paddingVertical: tokens.spacing[2],
  },
  credit: {
    alignSelf: 'flex-end',
    paddingBottom: tokens.spacing[2],
  },
}));
