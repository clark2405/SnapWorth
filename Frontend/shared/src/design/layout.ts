import { Platform, useWindowDimensions } from 'react-native';

import { layoutClassFor, type LayoutClass } from './layout-class';

export * from './layout-class';

export function useLayoutClass(): LayoutClass {
  const { width } = useWindowDimensions();
  return layoutClassFor(width, Platform.OS);
}

/** Whether the screen is wide enough for a sidebar and wide content rather than the phone layout. */
export function useWideLayout(): boolean {
  return useLayoutClass() !== 'compact';
}
