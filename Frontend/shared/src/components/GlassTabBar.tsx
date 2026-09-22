import { Camera, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { tokens } from '../design';
import { GlassCard } from './GlassCard';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';

export interface GlassTabItem<Key extends string> {
  readonly key: Key;
  readonly label: string;
  readonly icon: LucideIcon;
}

export interface GlassTabBarProps<Key extends string> {
  /** Two tabs sit either side of the capture button. */
  readonly leading: readonly [GlassTabItem<Key>, GlassTabItem<Key>];
  readonly trailing: readonly [GlassTabItem<Key>, GlassTabItem<Key>];
  readonly activeKey?: Key;
  readonly onSelect: (key: Key) => void;
  readonly onCapture: () => void;
}

/**
 * A floating glass pill with the capture button at its centre. Capture is the product's core
 * action, so it is the one element in the bar that glows.
 */
export function GlassTabBar<Key extends string>({
  leading,
  trailing,
  activeKey,
  onSelect,
  onCapture,
}: GlassTabBarProps<Key>) {
  const renderTab = (item: GlassTabItem<Key>) => {
    const active = item.key === activeKey;
    const tone = active ? 'accent' : 'textMuted';
    const Icon = item.icon;

    return (
      <PressableScale
        key={item.key}
        accessibilityRole="tab"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
        onPress={() => onSelect(item.key)}
        containerStyle={styles.tabSlot}
        style={styles.tab}
      >
        <Icon size={22} strokeWidth={1.75} color={tokens.color.dark[tone]} />
        <SWText variant="tabLabel" tone={tone}>
          {item.label}
        </SWText>
      </PressableScale>
    );
  };

  return (
    <View style={styles.dock} pointerEvents="box-none">
      <View style={styles.column} pointerEvents="box-none">
        <GlassCard tone="chrome" blur radius={tokens.radius.full} style={styles.bar}>
          <View accessibilityRole="tablist" style={styles.row}>
            {leading.map(renderTab)}
            <View style={styles.captureSlot}>
              <PressableScale
                accessibilityLabel="Capture an item"
                accessibilityHint="Opens the camera to photograph something and get an estimate"
                onPress={onCapture}
                style={styles.capture}
              >
                <Camera size={22} strokeWidth={2} color={tokens.color.dark.onAccent} />
              </PressableScale>
            </View>
            {trailing.map(renderTab)}
          </View>
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: tokens.spacing[6],
    alignItems: 'center',
  },
  column: {
    width: '100%',
    maxWidth: tokens.layout.phoneColumn,
    paddingHorizontal: tokens.layout.tabBarInset,
  },
  bar: {
    height: tokens.layout.tabBarHeight,
    borderColor: tokens.glass.borderStrong,
  },
  row: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing[1],
  },
  tabSlot: {
    flex: 1,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[1],
    minHeight: tokens.focus.minimumTarget,
  },
  captureSlot: {
    flex: 1,
    alignItems: 'center',
  },
  capture: {
    width: tokens.layout.tabBarCapture,
    height: tokens.layout.tabBarCapture,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.dark.accent,
    boxShadow: tokens.glow.capture,
  },
});
