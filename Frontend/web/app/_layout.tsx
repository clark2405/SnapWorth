import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts as useInterFonts,
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
  useFonts as useSpaceGroteskFonts,
} from '@expo-google-fonts/space-grotesk';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RevealGate } from '@snapworth/shared/components';
import { tokens } from '@snapworth/shared/design';
import { SplashView } from '@snapworth/shared/features/launch';

export default function RootLayout() {
  const [displayLoaded, displayError] = useSpaceGroteskFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });
  const [interLoaded, interError] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  // Render with fallback fonts if a face fails to load rather than blocking the app.
  const ready = (displayLoaded || Boolean(displayError)) && (interLoaded || Boolean(interError));
  // The first route mounts under the launch screen and starts its entrance as the splash clears.
  const [revealOpen, setRevealOpen] = useState(false);
  const [launched, setLaunched] = useState(false);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: tokens.color.dark.canvas }}>
        <RevealGate open={revealOpen}>
          {ready ? (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: tokens.color.dark.canvas },
              }}
            />
          ) : null}
        </RevealGate>
        {launched ? null : (
          <SplashView
            ready={ready}
            onExit={() => setRevealOpen(true)}
            onDone={() => setLaunched(true)}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}
