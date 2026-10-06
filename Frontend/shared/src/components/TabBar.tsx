import { Camera, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutRectangle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../design';
import { GlassSurface } from './GlassSurface';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';
import { usePop } from './usePop';

export interface TabItem<Key extends string> {
  readonly key: Key;
  readonly label: string;
  readonly icon: LucideIcon;
}

export interface TabBarProps<Key extends string> {
  /** Two tabs sit either side of the capture button. */
  readonly leading: readonly [TabItem<Key>, TabItem<Key>];
  readonly trailing: readonly [TabItem<Key>, TabItem<Key>];
  readonly activeKey?: Key;
  readonly onSelect: (key: Key) => void;
  readonly onCapture: () => void;
}

/**
 * A floating glass capsule for platforms without the native tab bar (the web): four tabs with
 * thin line icons, the active one in ink with a bold label on a soft gliding pill, either side
 * of the Snap button, the core action, in the accent.
 */
export function TabBar<Key extends string>({
  leading,
  trailing,
  activeKey,
  onSelect,
  onCapture,
}: TabBarProps<Key>) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
  const [slots, setSlots] = useState<Partial<Record<Key, LayoutRectangle>>>({});
  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const pillShown = useSharedValue(0);
  const placed = useSharedValue(false);

  const target = activeKey === undefined ? undefined : slots[activeKey];

  // One pill for the whole bar: it slides to the chosen tab and stretches to fit, so switching
  // tabs reads as the selection travelling rather than one tab dimming as another lights.
  useEffect(() => {
    if (!target) {
      pillShown.value = withSpring(0, tokens.motion.spring.snappy);
      return;
    }
    const x = target.x + 2;
    const width = target.width - 4;
    if (!placed.value || reduceMotion) {
      placed.value = true;
      pillX.value = x;
      pillWidth.value = width;
      pillShown.value = 1;
      return;
    }
    pillX.value = withSpring(x, tokens.motion.spring.smooth);
    pillWidth.value = withSpring(width, tokens.motion.spring.smooth);
    pillShown.value = withSpring(1, tokens.motion.spring.snappy);
  }, [pillShown, pillWidth, pillX, placed, reduceMotion, target]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillShown.value,
    width: pillWidth.value,
    transform: [{ translateX: pillX.value }, { scale: 0.85 + pillShown.value * 0.15 }],
  }));

  const renderTab = (item: TabItem<Key>) => (
    <View
      key={item.key}
      style={styles.tabSlot}
      onLayout={(event) => {
        const layout = event.nativeEvent.layout;
        setSlots((current) =>
          current[item.key]?.x === layout.x && current[item.key]?.width === layout.width
            ? current
            : { ...current, [item.key]: layout },
        );
      }}
    >
      <Tab
        item={item}
        active={item.key === activeKey}
        onPress={() => {
          if (item.key !== activeKey) haptic('select');
          onSelect(item.key);
        }}
      />
    </View>
  );

  return (
    <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, tokens.spacing[3]) }]}>
      <View style={styles.capsuleShadow}>
        <GlassSurface style={styles.capsule}>
          <View accessibilityRole="tablist" style={styles.row}>
            <Animated.View pointerEvents="none" style={[styles.pill, pillStyle]} />
            {leading.map(renderTab)}
            <SnapButton onPress={onCapture} />
            {trailing.map(renderTab)}
          </View>
        </GlassSurface>
      </View>
    </View>
  );
}

/**
 * The screen's one primary action, set in the middle of the bar: a vermilion pill with the
 * camera, so capturing is always one thumb-reach away whichever tab you are on.
 */
function SnapButton({ onPress }: { readonly onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);

  return (
    <View style={styles.snapSlot}>
      <PressableScale
        accessibilityLabel="Snap it"
        accessibilityHint="Opens the camera to photograph something and get an estimate"
        onPress={onPress}
        haptic="pop"
        style={({ pressed }) => [styles.snap, pressed ? styles.snapPressed : null]}
      >
        <Camera size={22} strokeWidth={2} color={colors.onAccent} />
      </PressableScale>
    </View>
  );
}

function Tab<Key extends string>({
  item,
  active,
  onPress,
}: {
  readonly item: TabItem<Key>;
  readonly active: boolean;
  readonly onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const iconPop = usePop(active, { enabled: active, peak: 1.2 });
  const tint = useSharedValue(active ? 1 : 0);
  const Icon = item.icon;

  useEffect(() => {
    tint.value = withTiming(active ? 1 : 0, { duration: tokens.motion.duration.base });
  }, [active, tint]);

  // The active icon and label fade up to full ink as the pill arrives beneath them.
  const restStyle = useAnimatedStyle(() => ({ opacity: 1 - tint.value }));
  const activeStyle = useAnimatedStyle(() => ({ opacity: tint.value }));

  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      haptic="none"
      onPress={onPress}
      containerStyle={styles.fill}
      style={styles.tab}
    >
      <Animated.View style={[styles.tabFace, restStyle]}>
        <Icon size={22} strokeWidth={1.75} color={colors.textMuted} />
        <SWText variant="tabLabel" tone="textMuted">
          {item.label}
        </SWText>
      </Animated.View>
      <Animated.View style={[styles.tabFace, styles.tabFaceActive, activeStyle]}>
        <Animated.View style={iconPop}>
          <Icon size={22} strokeWidth={2} color={colors.textPrimary} />
        </Animated.View>
        <SWText variant="tabLabelActive" tone="textPrimary">
          {item.label}
        </SWText>
      </Animated.View>
    </PressableScale>
  );
}

const stylesFor = themedStyles((colors, name) => ({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[4],
    pointerEvents: 'box-none',
  },
  capsuleShadow: {
    width: '100%',
    maxWidth: tokens.layout.phoneColumn - tokens.spacing[8],
    borderRadius: tokens.radius.full,
    shadowColor: tokens.lifted[name],
    shadowOpacity: 1,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
  },
  capsule: {
    width: '100%',
    borderRadius: tokens.radius.full,
  },
  row: {
    height: tokens.layout.floatingTabBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing[2],
  },
  tabSlot: {
    flex: 1,
    alignSelf: 'stretch',
  },
  fill: {
    flex: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabFace: {
    alignItems: 'center',
    gap: 3,
  },
  tabFaceActive: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    top: 9,
    bottom: 9,
    left: 0,
    borderRadius: tokens.radius.full,
    backgroundColor: colors.sunken,
  },
  snapSlot: {
    flex: 1,
    alignItems: 'center',
  },
  snap: {
    width: 60,
    height: 48,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    shadowColor: tokens.lifted[name],
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  snapPressed: {
    backgroundColor: colors.accentPressed,
  },
}));
