import { useRef } from 'react';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { morphPath } from './sign-in-handoff';
import type { TagPathProps } from './TagPath';

export type { TagPathProps } from './TagPath';

/**
 * The web's morphing shape: a plain SVG path whose outline is written straight onto the element
 * as the progress moves, with no React render per frame.
 */
export function TagPath({ progress, from, to, prefix = '', translate, ...paint }: TagPathProps) {
  const path = useRef<SVGPathElement>(null);
  const draw = (t: number) => path.current?.setAttribute('d', prefix + morphPath(from, to, t));
  useAnimatedReaction(
    () => progress.value,
    (t) => runOnJS(draw)(t),
  );
  return (
    <path
      ref={path}
      d={prefix + morphPath(from, to, progress.value)}
      strokeLinejoin="round"
      transform={translate ? `translate(${translate} ${translate})` : undefined}
      {...paint}
    />
  );
}
