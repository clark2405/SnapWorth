import { Stack, usePathname, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Companion, RevealGate, ToastProvider, useToast } from '@snapworth/shared/components';
import {
  ThemeProvider,
  useTheme,
  type ThemePreference,
  type ThemePreferenceStore,
} from '@snapworth/shared/design';
import { companionConfigFor } from '@snapworth/shared/features/companion';
import { SplashView } from '@snapworth/shared/features/launch';

const appearanceKey = 'snapworth.appearance';

/** Remembers the chosen appearance in this browser; storage may be unavailable (private mode). */
const browserThemeStore: ThemePreferenceStore = {
  async load() {
    try {
      const stored = globalThis.localStorage?.getItem(appearanceKey);
      return stored === 'light' || stored === 'dark' || stored === 'system'
        ? (stored as ThemePreference)
        : null;
    } catch {
      return null;
    }
  },
  async save(preference) {
    try {
      globalThis.localStorage?.setItem(appearanceKey, preference);
    } catch {
      // Private mode or blocked storage: the choice lasts for this visit only.
    }
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider store={browserThemeStore}>
          <ToastProvider>
            <Shell />
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell() {
  const { colors, isDark } = useTheme();
  // The first route mounts under the launch screen and starts its entrance as the splash clears.
  const [revealOpen, setRevealOpen] = useState(false);
  const [launched, setLaunched] = useState(false);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RevealGate open={revealOpen}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.canvas },
            animation: 'fade',
          }}
        />
        <WebCompanion ready={launched} />
      </RevealGate>
      {launched ? null : (
        <SplashView ready onExit={() => setRevealOpen(true)} onDone={() => setLaunched(true)} />
      )}
    </>
  );
}

function WebCompanion({ ready }: { readonly ready: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const config = useMemo(
    () =>
      companionConfigFor(pathname, {
        go: (href) => router.push(href as Href),
        ask: (question) => router.push({ pathname: '/worthy', params: { q: question } }),
        notify: (title, body) => toast.show({ title, body }),
      }),
    [pathname, router, toast],
  );

  return (
    <Companion
      actions={config.actions}
      greeting={config.greeting}
      hint={config.hint}
      hidden={!ready || config.hidden}
      bottomOffset={config.lift === 'tabBar' ? 84 : 92}
      onAsk={(question) => router.push({ pathname: '/worthy', params: { q: question } })}
      onHoldSnap={() => router.push('/capture')}
    />
  );
}
