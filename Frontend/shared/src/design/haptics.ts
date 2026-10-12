import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * The tactile half of the motion system. Each kind maps to one meaning so the vocabulary stays
 * small: `tap` for presses, `select` for changing a choice, `pop` for something arriving or
 * being liked, `success` and `warning` for outcomes. The web has no haptics, so it is silent.
 */
export type HapticKind = 'tap' | 'select' | 'pop' | 'heavy' | 'success' | 'warning' | 'none';

export function haptic(kind: HapticKind = 'tap'): void {
  if (Platform.OS === 'web' || kind === 'none') return;
  const run = (): Promise<void> => {
    switch (kind) {
      case 'tap':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'select':
        return Haptics.selectionAsync();
      case 'pop':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'heavy':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      case 'success':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'warning':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };
  run().catch(() => undefined);
}
