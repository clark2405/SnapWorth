import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts as useInterFonts,
} from '@expo-google-fonts/inter';
import {
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  useFonts as useOutfitFonts,
} from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { tokens } from '@snapworth/shared/design';

export default function RootLayout() {
  const [outfitLoaded, outfitError] = useOutfitFonts({
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });
  const [interLoaded, interError] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  // Render with fallback fonts if a face fails to load rather than blocking the app.
  const ready = (outfitLoaded || Boolean(outfitError)) && (interLoaded || Boolean(interError));

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {ready ? (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: tokens.color.dark.canvas },
          }}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: tokens.color.dark.canvas }} />
      )}
    </SafeAreaProvider>
  );
}
