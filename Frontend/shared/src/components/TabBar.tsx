import { Camera, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens, useMotionPreference } from '../design';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';
import { usePop } from './usePop';

const useNativeDriver = Platform.OS !== 'web';

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
 * A bar docked to the bottom edge. Capture is the product's core action, so it is the only
 * filled element here; the active tab is marked by weight and a short rule, not by colour alone.
 */
export function TabBar<Key extends string>({
  leading,
  trailing,
  activeKey,
  onSelect,
  onCapture,
}: TabBarProps<Key>) {
  const insets = useSafeAreaInsets();

  const renderTab = (item: TabItem<Key>) => (
    <Tab
      key={item.key}
      item={item}
      active={item.key === activeKey}
      onPress={() => onSelect(item.key)}
    />
  );

  return (
    <View style={[styles.dock, { paddingBottom: insets.bottom }]}>
      <View accessibilityRole="tablist" style={styles.row}>
        {leading.map(renderTab)}
        <View style={styles.captureSlot}>
          <PressableScale
            accessibilityLabel="Capture an item"
            accessibilityHint="Opens the camera to photograph something and get an estimate"
            onPress={onCapture}
            style={({ pressed }) => [styles.capture, pressed ? styles.capturePressed : null]}
          >
            <Camera size={22} strokeWidth={2} color={tokens.color.dark.onAccent} />
          </PressableScale>
        </View>
        {trailing.map(renderTab)}
      </View>
    </View>
  );
}

/**
 * The active rule grows out from the centre and the icon pops once as a tab becomes active.
 * Under reduced motion the rule simply appears.
 */
function Tab<Key extends string>({
  item,
  active,
  onPress,
}: {
  readonly item: TabItem<Key>;
  readonly active: boolean;
  readonly onPress: () => void;
}) {
  const { reduceMotion } = useMotionPreference();
  const iconScale = usePop(active, { enabled: active });
  const rule = useRef(new Animated.Value(active ? 1 : 0)).current;
  const tone = active ? 'textPrimary' : 'textMuted';
  const Icon = item.icon;

  useEffect(() => {
    const toValue = active ? 1 : 0;
    if (reduceMotion) {
      rule.setValue(toValue);
      return;
    }
    const animation = Animated.timing(rule, {
      toValue,
      duration: tokens.motion.recipe.functionalTransition.durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [active, reduceMotion, rule]);

  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      containerStyle={styles.tabSlot}
      style={styles.tab}
    >
      <Animated.View style={[styles.rule, { opacity: rule, transform: [{ scaleX: rule }] }]} />
      <Animated.View style={{ transform: [{ scale: iconScale }] }}>
        <Icon size={22} strokeWidth={active ? 2.25 : 1.75} color={tokens.color.dark[tone]} />
      </Animated.View>
      <SWText variant="tabLabel" tone={tone}>
        {item.label}
      </SWText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.color.dark.canvas,
    borderTopWidth: tokens.border.hairline,
    borderTopColor: tokens.color.dark.borderSubtle,
  },
  row: {
    width: '100%',
    maxWidth: tokens.layout.phoneColumn,
    alignSelf: 'center',
    height: tokens.layout.tabBarHeight,
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
    gap: tokens.spacing[1],
    minHeight: tokens.focus.minimumTarget,
  },
  rule: {
    position: 'absolute',
    top: 0,
    width: tokens.spacing[6],
    height: tokens.border.focus,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.dark.textPrimary,
  },
  captureSlot: {
    flex: 1,
    alignItems: 'center',
  },
  capture: {
    width: tokens.layout.tabBarCapture,
    height: tokens.layout.tabBarCapture,
    borderRadius: tokens.radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.dark.accent,
  },
  capturePressed: {
    backgroundColor: tokens.color.dark.accentPressed,
  },
});
