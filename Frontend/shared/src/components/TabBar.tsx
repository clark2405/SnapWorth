import { Camera, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
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
 * A floating glass capsule for platforms without the native tab bar (the web). Capture is the
 * core action, so it is the one filled control; the active tab lifts onto a soft pill.
 */
export function TabBar<Key extends string>({
  leading,
  trailing,
  activeKey,
  onSelect,
  onCapture,
}: TabBarProps<Key>) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);

  const renderTab = (item: TabItem<Key>) => (
    <Tab
      key={item.key}
      item={item}
      active={item.key === activeKey}
      onPress={() => {
        if (item.key !== activeKey) haptic('select');
        onSelect(item.key);
      }}
    />
  );

  return (
    <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, tokens.spacing[3]) }]}>
      <GlassSurface style={styles.capsule}>
        <View accessibilityRole="tablist" style={styles.row}>
          {leading.map(renderTab)}
          <View style={styles.captureSlot}>
            <PressableScale
              accessibilityLabel="Capture an item"
              accessibilityHint="Opens the camera to photograph something and get an estimate"
              onPress={onCapture}
              haptic="pop"
              style={({ pressed }) => [styles.capture, pressed ? styles.capturePressed : null]}
            >
              <Camera size={22} strokeWidth={2} color={colors.onAccent} />
            </PressableScale>
          </View>
          {trailing.map(renderTab)}
        </View>
      </GlassSurface>
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
  const reduceMotion = useReducedMotion();
  const iconPop = usePop(active, { enabled: active, peak: 1.2 });
  const lift = useSharedValue(active ? 1 : 0);
  const Icon = item.icon;

  useEffect(() => {
    lift.value = reduceMotion
      ? active
        ? 1
        : 0
      : withSpring(active ? 1 : 0, tokens.motion.spring.snappy);
  }, [active, lift, reduceMotion]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: lift.value,
    transform: [{ scale: 0.7 + lift.value * 0.3 }],
  }));

  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      haptic="none"
      onPress={onPress}
      containerStyle={styles.tabSlot}
      style={styles.tab}
    >
      <Animated.View style={[styles.pill, pillStyle]} />
      <Animated.View style={iconPop}>
        <Icon
          size={21}
          strokeWidth={active ? 2.3 : 1.8}
          color={active ? colors.textPrimary : colors.textMuted}
        />
      </Animated.View>
      <SWText variant="tabLabel" tone={active ? 'textPrimary' : 'textMuted'}>
        {item.label}
      </SWText>
    </PressableScale>
  );
}

const stylesFor = themedStyles((colors) => ({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: tokens.spacing[4],
    pointerEvents: 'box-none',
  },
  capsule: {
    width: '100%',
    maxWidth: tokens.layout.phoneColumn - tokens.spacing[8],
    borderRadius: tokens.radius.full,
  },
  row: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing[2],
  },
  tabSlot: {
    flex: 1,
    alignSelf: 'stretch',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pill: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 2,
    right: 2,
    borderRadius: tokens.radius.full,
    backgroundColor: colors.sunken,
  },
  captureSlot: {
    flex: 1,
    alignItems: 'center',
  },
  capture: {
    width: 50,
    height: 50,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  capturePressed: {
    backgroundColor: colors.accentPressed,
  },
}));
