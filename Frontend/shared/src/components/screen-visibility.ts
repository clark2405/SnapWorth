import type { ViewProps } from 'react-native';

/**
 * Props for a screen's root that let the platform skip rendering it while it's out of view. The
 * native navigators detach screens themselves, so there's nothing to add here; see the web file.
 */
export function useScreenVisibility(_focused: boolean): Partial<ViewProps> {
  return {};
}
