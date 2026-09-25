import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, Platform, StyleSheet, View, useColorScheme } from 'react-native';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { resolveThemeName, type ThemeColors, type ThemePreference } from './theme';
import { tokens, type ThemeName } from './tokens';

/** Where the chosen appearance is remembered; the app shell supplies a device store. */
export interface ThemePreferenceStore {
  load(): Promise<ThemePreference | null>;
  save(preference: ThemePreference): Promise<void>;
}

export interface ThemeContextValue {
  readonly name: ThemeName;
  readonly isDark: boolean;
  readonly colors: ThemeColors;
  readonly preference: ThemePreference;
  readonly setPreference: (preference: ThemePreference) => void;
}

const fallback: ThemeContextValue = Object.freeze({
  name: 'dark',
  isDark: true,
  colors: tokens.color.dark,
  preference: 'system',
  setPreference: () => undefined,
});

const ThemeContext = createContext<ThemeContextValue>(fallback);

export interface ThemeProviderProps {
  readonly children: ReactNode;
  readonly store?: ThemePreferenceStore;
  readonly initialPreference?: ThemePreference;
}

/**
 * Resolves the active palette from the user's preference and the device appearance. An
 * explicit choice is pushed to `Appearance`, so native chrome (tab bar glass, keyboards,
 * alerts) follows the app rather than the device. Switching dips through the outgoing canvas
 * so the change reads as one deliberate beat instead of a flash.
 */
export function ThemeProvider({
  children,
  store,
  initialPreference = 'system',
}: ThemeProviderProps) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  // The device appearance before any override, so "system" can be restored faithfully.
  const deviceScheme = useRef<ThemeName>(system === 'light' ? 'light' : 'dark');
  if (preference === 'system' && (system === 'light' || system === 'dark')) {
    deviceScheme.current = system;
  }

  useEffect(() => {
    let active = true;
    void store?.load().then((stored) => {
      if (active && stored) setPreferenceState(stored);
    });
    return () => {
      active = false;
    };
  }, [store]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  const name = resolveThemeName(preference, deviceScheme.current);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      void store?.save(next);
    },
    [store],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      name,
      isDark: name === 'dark',
      colors: tokens.color[name],
      preference,
      setPreference,
    }),
    [name, preference, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[styles.root, { backgroundColor: value.colors.canvas }]}>
        {children}
        <ThemeDip name={name} />
      </View>
    </ThemeContext.Provider>
  );
}

/** A full-bleed veil in the outgoing canvas colour that fades away after a theme change. */
function ThemeDip({ name }: { readonly name: ThemeName }) {
  const previous = useRef(name);
  const [veil, setVeil] = useState<string | null>(null);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (previous.current === name) return;
    setVeil(tokens.color[previous.current].canvas);
    previous.current = name;
    opacity.value = 1;
    opacity.value = withTiming(0, { duration: 420, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  }, [name, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!veil) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.veil, { backgroundColor: veil }, style]}
    />
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

type StyleFactory<T> = (colors: ThemeColors, name: ThemeName) => T;
const styleCache = new WeakMap<StyleFactory<unknown>, Partial<Record<ThemeName, unknown>>>();

/**
 * Builds a component's styles for the active theme, once per theme. Pass a module-level
 * factory (not an inline arrow) so the cache can hold it.
 */
export function useThemedStyles<T>(factory: StyleFactory<T>): T {
  const { name, colors } = useTheme();
  let entry = styleCache.get(factory as StyleFactory<unknown>);
  if (!entry) {
    entry = {};
    styleCache.set(factory as StyleFactory<unknown>, entry);
  }
  if (!(name in entry)) entry[name] = factory(colors, name);
  return entry[name] as T;
}

/** Identity helper that types a theme-aware `StyleSheet.create` factory. */
export function themedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: ThemeColors, name: ThemeName) => T,
): StyleFactory<T> {
  return (colors, name) => StyleSheet.create(factory(colors, name));
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  veil: { pointerEvents: 'none' },
});
