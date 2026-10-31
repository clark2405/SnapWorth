import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { tokens, useTheme } from '../design';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';

/**
 * The Snap control's face, shared by iOS and Android so both read the same. It is the brand's
 * two halves, like the wordmark: the lens you snap with on the left, and on the right the
 * price tag still waiting for its number.
 */
export function SnapRow({
  compact,
  onPress,
}: {
  readonly compact: boolean;
  readonly onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Snap it"
      accessibilityHint="Opens the camera to photograph something and find out what it's worth"
      haptic="pop"
      onPress={onPress}
      style={[styles.row, compact ? styles.rowCompact : null]}
    >
      <Lens size={compact ? compactLens : 36} />
      <View style={styles.text}>
        <SWText variant="label">Snap it</SWText>
        {compact ? null : (
          <SWText variant="caption" tone="textSecondary" numberOfLines={1}>
            Find out what it&apos;s{' '}
            <SWText variant="caption" tone="accent">
              worth
            </SWText>
          </SWText>
        )}
      </View>
      {/* Folded or not, the tag closes the row: the lens snaps, the tag tells you the worth. */}
      <PriceTag />
    </PressableScale>
  );
}

/** The lens from the logo and the wordmark's "o": an accent body, a cream ring, an ink pupil. */
function Lens({ size }: { readonly size: number }) {
  const { colors } = useTheme();
  const c = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={c} cy={c} r={c} fill={colors.accent} />
      <Circle cx={c} cy={c} r={size * 0.3} fill={lensRing} />
      <Circle cx={c} cy={c} r={size * 0.2} fill={lensPupil} />
      <Circle cx={c + size * 0.075} cy={c - size * 0.075} r={size * 0.06} fill={lensRing} />
    </Svg>
  );
}

const tagWidth = 56;
const tagHeight = 28;
/** How far the tag's point runs in from its left edge. */
const tagPoint = 11;

/** The logo's price tag laid on its side, pointing at the lens, its price still a question. */
function PriceTag() {
  const { colors } = useTheme();
  // Drawn a hair inside the box so the outline is not clipped at the edges.
  const inset = 0.75;
  const w = tagWidth - inset * 2;
  const h = tagHeight - inset * 2;
  const p = tagPoint;
  const r = 7;
  const outline = [
    `M${p + 2} 0`,
    `L${w - r} 0`,
    `Q${w} 0 ${w} ${r}`,
    `L${w} ${h - r}`,
    `Q${w} ${h} ${w - r} ${h}`,
    `L${p + 2} ${h}`,
    `Q${p} ${h} ${p - 1.4} ${h - 1.3}`,
    `L1.4 ${h / 2 + 1.4}`,
    `Q0 ${h / 2} 1.4 ${h / 2 - 1.4}`,
    `L${p - 1.4} 1.3`,
    `Q${p} 0 ${p + 2} 0`,
    'Z',
  ].join(' ');
  return (
    <View style={styles.tag} accessibilityElementsHidden importantForAccessibility="no">
      <Svg width={tagWidth} height={tagHeight} style={StyleSheet.absoluteFill}>
        <G x={inset} y={inset}>
          <Path
            d={outline}
            fill={colors.accentSoft}
            stroke={colors.accent}
            strokeOpacity={0.35}
            strokeWidth={1}
          />
          {/* The eyelet, drawn as a ring so it reads on glass as well as on a solid bar. */}
          <Circle
            cx={p * 0.66}
            cy={h / 2}
            r={2.2}
            fill="none"
            stroke={colors.accent}
            strokeWidth={1.4}
          />
        </G>
      </Svg>
      <SWText variant="labelSmall" tone="accent" style={styles.tagText}>
        ₱ ?
      </SWText>
    </View>
  );
}

// The lens reads the same in both appearances, as in the logo: a cream ring, an ink pupil.
const lensRing = tokens.color.dark.textPrimary;
const lensPupil = tokens.color.light.textPrimary;

// The accessory's content view is laid out with no height of its own (react-native-screens
// 4.26), so the row sets its height itself rather than stretching to fill it. Both placements
// are 48pt glass capsules on iOS 26, so the row matches them and centres its content.
const regularHeight = 48;
const compactHeight = 48;
/** In the folded capsule the lens keeps the same 8pt margin top, bottom and leading. */
const compactLens = compactHeight - tokens.spacing[2] * 2;
/** The tag sits as far from the capsule's end as from its top and bottom. */
const tagInset = (regularHeight - tagHeight) / 2;

const styles = StyleSheet.create({
  row: {
    height: regularHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingLeft: tokens.spacing[2],
    paddingRight: tagInset,
  },
  rowCompact: {
    height: compactHeight,
    gap: tokens.spacing[2],
  },
  tag: {
    width: tagWidth,
    height: tagHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: tagPoint,
  },
  tagText: {
    letterSpacing: 0.5,
  },
  text: {
    flex: 1,
  },
});
