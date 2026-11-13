import type { RefObject } from 'react';
import type { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import type { GenieGeometry } from './genie-mesh';

/**
 * The web build has no Skia (it would mean shipping CanvasKit for one animation), so the
 * companion's panel shrinks back into Worthy instead of pouring in like a genie.
 */
export type GeniePicture = never;

export const genieSupported = false;

export function pictureOf(_view: RefObject<View | null>): Promise<GeniePicture | null> {
  return Promise.resolve(null);
}

export function GenieCanvas(_props: {
  readonly picture: GeniePicture;
  readonly geometry: GenieGeometry;
  readonly progress: SharedValue<number>;
}) {
  return null;
}
