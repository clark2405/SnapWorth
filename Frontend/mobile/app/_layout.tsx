// supabase-js needs a complete URL implementation, which React Native does not ship.
import 'react-native-url-polyfill/auto';

import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { LogBox, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NavLinkProvider, RevealGate, ToastProvider } from '@snapworth/shared/components';
import { ThemeProvider, useTheme } from '@snapworth/shared/design';
import { AppServicesProvider, type BackendConfig } from '@snapworth/shared/composition';
import { useSnapWorthFonts } from '@snapworth/shared/design/font-assets';
import { SplashView } from '@snapworth/shared/features/launch';
import { SessionProvider } from '@snapworth/shared/features/session';
import { TipsProvider } from '@snapworth/shared/features/tips';

import { CompanionHost } from '../src/CompanionHost';
import { renderNavLink, renderZoomSource, renderZoomTarget } from '../src/nav-bridge';
import { deviceThemeStore } from '../src/theme-store';
import { deviceTipStore } from '../src/tip-store';

// A Supabase project's URL and public anon key, from EXPO_PUBLIC_* environment variables
// (see Backend/README.md). Without them, comments are kept on this device instead.
// A known, harmless warning from React Native's animated module when a native-driven value
// updates after its last listener has gone; it carries no action, so it stays out of the way.
LogBox.ignoreLogs(['Sending `onAnimatedValueUpdate` with no listeners registered.']);

const backend: BackendConfig = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppServicesProvider config={backend}>
          <ThemeProvider store={deviceThemeStore}>
            <ToastProvider>
              <NavLinkProvider
                link={renderNavLink}
                target={renderZoomTarget}
                source={renderZoomSource}
              >
                <Shell />
              </NavLinkProvider>
            </ToastProvider>
          </ThemeProvider>
        </AppServicesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  // The first route mounts under the launch screen and starts its entrance as the splash clears.
  const [revealOpen, setRevealOpen] = useState(false);
  const [launched, setLaunched] = useState(false);
  const fontsReady = useSnapWorthFonts();

  // Hold on the bare canvas for the moment the bundled faces take to load, so no text ever
  // renders in a fallback face and then jumps.
  if (!fontsReady) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;

  return (
    // Guests can look around; acting asks for an account and comes back here afterwards.
    <SessionProvider
      onCreateAccount={() => router.push('/signup?return=1')}
      onSignIn={() => router.push('/login?return=1')}
    >
      <TipsProvider store={deviceTipStore}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <RevealGate open={revealOpen}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.canvas },
              // Native iOS push: interactive edge-swipe back with the system parallax.
              animation: 'default',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              // iOS 26 clips scroll views at the screen edges on its own. Its automatic style drew
              // a hard cut line above the bottom bars; a soft edge lets content blur away under the
              // floating bar like the system's toolbars. The top is ours: each header draws its own
              // soft fade, so the system one stays off rather than doubling it.
              scrollEdgeEffects: { top: 'hidden', bottom: 'soft', left: 'hidden', right: 'hidden' },
            }}
          >
            <Stack.Screen name="index" options={{ animation: 'none' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="(auth)/login" options={{ animation: 'fade' }} />
            <Stack.Screen name="(auth)/signup" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal' }} />
            {/* The snap's answer: a sheet over the frozen camera, half height first. */}
            <Stack.Screen
              name="estimate/[id]"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.56, 1],
                sheetInitialDetentIndex: 0,
                sheetGrabberVisible: true,
                // No corner radius of our own: iOS 26 rounds the sheet's corners to follow the
                // screen's, which a fixed radius would flatten at the bottom.
                sheetExpandsWhenScrolledToEdge: true,
                contentStyle: { backgroundColor: colors.canvas },
              }}
            />
            <Stack.Screen name="worthy" options={{ presentation: 'modal' }} />
            <Stack.Screen name="ask/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="list/[id]" options={{ presentation: 'modal' }} />
          </Stack>
          <CompanionHost ready={launched} />
        </RevealGate>
        {launched ? null : (
          <SplashView ready onExit={() => setRevealOpen(true)} onDone={() => setLaunched(true)} />
        )}
      </TipsProvider>
    </SessionProvider>
  );
}
