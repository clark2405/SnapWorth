import { useSyncExternalStore } from 'react';
import { useWindowDimensions, type ScaledSize } from 'react-native';

/**
 * The window's size as the website's static pages were built with it: there is no window while
 * they're rendered ahead of time, so everything sized from it is drawn for nothing at all.
 */
const prerenderedWindow: ScaledSize = { width: 0, height: 0, scale: 1, fontScale: 1 };

const noChange = () => () => undefined;

/**
 * False while the browser takes over a page the website rendered ahead of time, then true. The
 * server snapshot is what React reads during that takeover, so the first pass matches the page
 * exactly; it then renders again with the real value. Apps have no prerendered pages: always true.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noChange,
    () => true,
    () => false,
  );
}

/**
 * The window's size, for anything drawn or laid out from it. Use this instead of React Native's
 * `useWindowDimensions`: on the website the first pass has to draw what the prebuilt page drew
 * (sized for no window), or React finds the page doesn't match and throws it away. A moment
 * later, the real size takes over.
 */
export function useWindowSize(): ScaledSize {
  const window = useWindowDimensions();
  return useHydrated() ? window : prerenderedWindow;
}
