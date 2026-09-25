import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NavLinkProvider, RevealGate, ToastProvider } from '@snapworth/shared/components';
import { ThemeProvider, useTheme } from '@snapworth/shared/design';
import { SplashView } from '@snapworth/shared/features/launch';

import { CompanionHost } from '../src/CompanionHost';
import { renderNavLink, renderZoomTarget } from '../src/nav-bridge';
import { deviceThemeStore } from '../src/theme-store';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider store={deviceThemeStore}>
          <ToastProvider>
            <NavLinkProvider link={renderNavLink} target={renderZoomTarget}>
              <Shell />
            </NavLinkProvider>
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
            // Native iOS push: interactive edge-swipe back with the system parallax.
            animation: 'default',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="(auth)/login" options={{ animation: 'fade' }} />
          <Stack.Screen name="(auth)/signup" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="worthy" options={{ presentation: 'modal' }} />
          <Stack.Screen name="ask/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="list/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="search" options={{ animation: 'fade_from_bottom' }} />
        </Stack>
        <CompanionHost ready={launched} />
      </RevealGate>
      {launched ? null : (
        <SplashView ready onExit={() => setRevealOpen(true)} onDone={() => setLaunched(true)} />
      )}
    </>
  );
}
