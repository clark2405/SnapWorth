import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * iOS page sheets start below the status bar, but the root safe-area insets still include it.
 * A provider measured inside the sheet reports the sheet's own insets instead.
 */
export function ModalSafeArea({ children }: { readonly children: ReactNode }) {
  return <SafeAreaProvider>{children}</SafeAreaProvider>;
}
