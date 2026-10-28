import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { Path } from 'react-native-svg';

import { morphPath } from './sign-in-handoff';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface TagPathProps {
  /** 0 is `from`, 1 is `to`. */
  readonly progress: SharedValue<number>;
  readonly from: readonly number[];
  readonly to: readonly number[];
  /** Path data drawn before the morphing outline, such as the screen's rectangle for a cut-out. */
  readonly prefix?: string;
  readonly fill: string;
  readonly fillRule?: 'evenodd' | 'nonzero';
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly translate?: number;
}

/** A shape morphing between two outlines, its path redrawn on the UI thread every frame. */
export function TagPath({ progress, from, to, prefix = '', translate, ...paint }: TagPathProps) {
  const animatedProps = useAnimatedProps(() => ({
    d: prefix + morphPath(from, to, progress.value),
  }));
  return (
    <AnimatedPath
      animatedProps={animatedProps}
      strokeLinejoin="round"
      transform={translate ? `translate(${translate} ${translate})` : undefined}
      {...paint}
    />
  );
}
