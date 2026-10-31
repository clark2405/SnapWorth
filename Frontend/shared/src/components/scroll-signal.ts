import { makeMutable } from 'react-native-reanimated';

/**
 * 0 at rest, rising to 1 while the reader scrolls on into new content. Floating chrome (the
 * companion orb) reads it to step out of the way while content moves, then return when the
 * page settles. Written by `Screen`, on the UI thread only.
 */
export const contentScrolling = makeMutable(0);

/**
 * 1 while the web's tab bar is folded down, 0 while it's open. Like iOS's tab bar, it folds as
 * the reader scrolls on down a tab's page and opens again as soon as they scroll back up, reach
 * the top, or tap it. Written by `Screen` (tab pages only) and the tab bar itself.
 */
export const tabBarFolded = makeMutable(0);

const scrollToTopListeners = new Set<() => void>();

/**
 * Asks the open tab's page to scroll back to its top, as tapping the tab you are already on
 * does. Native tabs raise this through the navigator; the web's own tab bar raises it here.
 */
export function requestScrollToTop() {
  scrollToTopListeners.forEach((listener) => listener());
}

export function onScrollToTopRequest(listener: () => void) {
  scrollToTopListeners.add(listener);
  return () => {
    scrollToTopListeners.delete(listener);
  };
}
