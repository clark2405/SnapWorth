import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { BricolageGrotesque_400Regular } from '@expo-google-fonts/bricolage-grotesque/400Regular';
import { BricolageGrotesque_500Medium } from '@expo-google-fonts/bricolage-grotesque/500Medium';
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { DMMono_400Regular } from '@expo-google-fonts/dm-mono/400Regular';
import { DMMono_500Medium } from '@expo-google-fonts/dm-mono/500Medium';
import { useFonts } from 'expo-font';

import { displayFaces, fontFaces, monoFaces } from './fonts';

const fontAssets = {
  [fontFaces['400']]: PlusJakartaSans_400Regular,
  [fontFaces['500']]: PlusJakartaSans_500Medium,
  [fontFaces['600']]: PlusJakartaSans_600SemiBold,
  [fontFaces['700']]: PlusJakartaSans_700Bold,
  [fontFaces['800']]: PlusJakartaSans_800ExtraBold,
  [displayFaces['400']]: BricolageGrotesque_400Regular,
  [displayFaces['500']]: BricolageGrotesque_500Medium,
  [displayFaces['600']]: BricolageGrotesque_600SemiBold,
  [displayFaces['700']]: BricolageGrotesque_700Bold,
  [displayFaces['800']]: BricolageGrotesque_800ExtraBold,
  [monoFaces['400']]: DMMono_400Regular,
  [monoFaces['500']]: DMMono_500Medium,
};

/**
 * Loads the bundled faces. Apps hold their first frame until this is true (or the load failed,
 * in which case text falls back to the system face rather than blocking launch).
 */
export function useSnapWorthFonts(): boolean {
  const [loaded, error] = useFonts(fontAssets);
  return loaded || error !== null;
}
