import {
  Canvas,
  FilterMode,
  ImageShader,
  MipmapMode,
  Vertices,
  makeImageFromView,
  type SkImage,
} from '@shopify/react-native-skia';
import { useMemo, type RefObject } from 'react';
import { StyleSheet, type View } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { genieIndices, geniePoints, genieTextures, type GenieGeometry } from './genie-mesh';

export type GeniePicture = SkImage;

/** Phones draw the genie; the web build shrinks the panel back instead. */
export const genieSupported = true;

/**
 * A picture of the view as it looks now, or null when one can't be taken in time (the panel then
 * simply shrinks away, rather than waiting on it).
 */
export function pictureOf(view: RefObject<View | null>): Promise<GeniePicture | null> {
  return Promise.race([
    makeImageFromView(view).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 400)),
  ]);
}

/**
 * The panel's picture drawn on a bending mesh (see genie-mesh.ts), standing in for the panel
 * while it pours back into Worthy. `progress` runs from 0 (open) to 1 (inside Worthy).
 */
export function GenieCanvas({
  picture,
  geometry,
  progress,
}: {
  readonly picture: GeniePicture;
  readonly geometry: GenieGeometry;
  readonly progress: SharedValue<number>;
}) {
  const textures = useMemo(
    () => genieTextures(geometry.width, geometry.height),
    [geometry.height, geometry.width],
  );
  const indices = useMemo(genieIndices, []);
  const vertices = useDerivedValue(() => geniePoints(geometry, progress.value));
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Vertices vertices={vertices} textures={textures} indices={indices} mode="triangles">
        <ImageShader
          image={picture}
          x={0}
          y={0}
          width={geometry.width}
          height={geometry.height}
          fit="fill"
          sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }}
        />
      </Vertices>
    </Canvas>
  );
}
