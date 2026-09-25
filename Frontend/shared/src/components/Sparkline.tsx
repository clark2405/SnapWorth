import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '../design';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface SparklineProps {
  readonly values: readonly number[];
  readonly height?: number;
  /** Draw the area under the line as a soft wash. */
  readonly filled?: boolean;
}

/** A smooth trend line that draws itself left to right, like a pen stroke, when it appears. */
export function Sparkline({ values, height = 56, filled = true }: SparklineProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const draw = useSharedValue(reduceMotion ? 1 : 0);

  const { line, area, length } = useMemo(() => {
    if (width === 0 || values.length < 2) return { line: '', area: '', length: 0 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = 4;
    const points = values.map((value, index) => ({
      x: (index / (values.length - 1)) * width,
      y: pad + (1 - (value - min) / (max - min || 1)) * (height - pad * 2),
    }));
    // Catmull-Rom to cubic Bézier for a calm curve through every point.
    let d = `M ${points[0]!.x} ${points[0]!.y}`;
    let total = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i - 1] ?? points[i]!;
      const p1 = points[i]!;
      const p2 = points[i + 1]!;
      const p3 = points[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
      total += Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }
    return { line: d, area: `${d} L ${width} ${height} L 0 ${height} Z`, length: total * 1.15 };
  }, [height, values, width]);

  useEffect(() => {
    if (reduceMotion || length === 0) return;
    draw.value = 0;
    draw.value = withTiming(1, { duration: 1100, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  }, [draw, length, reduceMotion]);

  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - draw.value) }));
  const areaProps = useAnimatedProps(() => ({ opacity: draw.value }));

  return (
    <View style={{ height }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="spark-wash" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={0.28} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {filled ? (
            <AnimatedPath d={area} fill="url(#spark-wash)" animatedProps={areaProps} />
          ) : null}
          <AnimatedPath
            d={line}
            stroke={colors.accent}
            strokeWidth={2.2}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={[length, length]}
            animatedProps={lineProps}
          />
        </Svg>
      ) : null}
    </View>
  );
}
