import { useEffect } from 'react';
import type { ViewProps } from 'react-native';

// The web's tab navigator keeps every tab it has shown mounted, stacked under the one in view,
// and a stack keeps the screens below the top one. Left alone the browser lays out and paints
// all of them, every frame. A screen out of view skips rendering its contents instead, which
// keeps its state and scroll position for when it comes back.
const css = '[data-sw-screen="away"]{content-visibility:hidden;visibility:hidden}';

let injected = false;

export function useScreenVisibility(focused: boolean): Partial<ViewProps> {
  useEffect(() => {
    if (injected || typeof document === 'undefined') return;
    const sheet = document.createElement('style');
    sheet.setAttribute('data-snapworth-screens', '');
    sheet.textContent = css;
    document.head.appendChild(sheet);
    injected = true;
  }, []);
  // react-native-web writes `dataSet` out as data-* attributes.
  return { dataSet: { swScreen: focused ? 'here' : 'away' } } as Partial<ViewProps>;
}
