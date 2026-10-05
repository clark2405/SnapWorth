import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { useFonts } from 'expo-font';

import { fontFaces } from './fonts';

const fontAssets = {
  [fontFaces['400']]: PlusJakartaSans_400Regular,
  [fontFaces['500']]: PlusJakartaSans_500Medium,
  [fontFaces['600']]: PlusJakartaSans_600SemiBold,
  [fontFaces['700']]: PlusJakartaSans_700Bold,
  [fontFaces['800']]: PlusJakartaSans_800ExtraBold,
};

/**
 * Loads the bundled faces. Apps hold their first frame until this is true (or the load failed,
 * in which case text falls back to the system face rather than blocking launch).
 */
export function useSnapWorthFonts(): boolean {
  const [loaded, error] = useFonts(fontAssets);
  return loaded || error !== null;
}
