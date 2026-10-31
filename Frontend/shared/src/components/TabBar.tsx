import { Search, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutRectangle } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedReaction,
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
import { SnapRow } from './SnapRow';
import { SWText } from './SWText';
import { tabBarFolded } from './scroll-signal';
import { usePop } from './usePop';
import { paperLayout } from './paper-motion';

export interface TabItem<Key extends string> {
  readonly key: Key;
  readonly label: string;
  readonly icon: LucideIcon;
}

export interface TabBarProps<Key extends string> {
  readonly tabs: readonly TabItem<Key>[];
  readonly activeKey?: Key;
  readonly onSelect: (key: Key) => void;
  /** Opens the camera. Snap rides above the tabs, as it does on iOS. */
  readonly onSnap?: () => void;
  /** Opens search, in its own circle beside the tabs, as on iOS. */
  readonly onSearch?: () => void;
}

/**
 * The tab bar for platforms without the native one (the web), laid out like iOS's: Snap, the
 * core action, rides above in its own bar; below, the places in a floating glass capsule, with
 * search in a circle of its own beside them. Tabs have thin line icons, the active one in ink
 * with a bold label on a soft gliding pill.
 */
export function TabBar<Key extends string>({
  tabs,
  activeKey,
  onSelect,
  onSnap,
  onSearch,
}: TabBarProps<Key>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
  const [slots, setSlots] = useState<Partial<Record<Key, LayoutRectangle>>>({});
  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const pillShown = useSharedValue(0);
  const placed = useSharedValue(false);

  const target = activeKey === undefined ? undefined : slots[activeKey];

  // Folded, as iOS's bar folds while you scroll down a page: the open tab, a compact Snap and
  // search on one row. Scrolling back up, reaching the top, switching tabs or tapping the tab
  // opens it again.
  const [folded, setFolded] = useState(false);
  useAnimatedReaction(
    () => tabBarFolded.value > 0.5,
    (now, before) => {
      if (now !== before) runOnJS(setFolded)(now);
    },
  );
  useEffect(() => {
    tabBarFolded.value = 0;
  }, [activeKey]);
  const unfold = () => {
    tabBarFolded.value = 0;
  };
  const activeTab = tabs.find((item) => item.key === activeKey);

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

  const search = (size: 'regular' | 'folded') =>
    onSearch ? (
      <View style={styles.shadow}>
        <GlassSurface style={size === 'folded' ? styles.foldedCircle : styles.searchCircle}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Search"
            onPress={onSearch}
            style={size === 'folded' ? styles.foldedCircle : styles.searchButton}
          >
            <Search
              size={size === 'folded' ? 22 : 24}
              strokeWidth={1.75}
              color={colors.textPrimary}
            />
          </PressableScale>
        </GlassSurface>
      </View>
    ) : null;

  const dockStyle = [styles.dock, { paddingBottom: Math.max(insets.bottom, tokens.spacing[3]) }];

  if (folded && activeTab) {
    const Icon = activeTab.icon;
    return (
      <View style={dockStyle}>
        <Animated.View
          entering={FadeIn.duration(tokens.motion.duration.base)}
          exiting={FadeOut.duration(tokens.motion.duration.base)}
          layout={paperLayout}
          style={styles.bottomRow}
        >
          <View style={styles.shadow}>
            <GlassSurface style={styles.foldedTab}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${activeTab.label}. Show all tabs`}
                onPress={unfold}
                style={styles.foldedTabFace}
              >
                <Icon size={20} strokeWidth={2} color={colors.textPrimary} />
                <SWText variant="tabLabelActive" tone="textPrimary">
                  {activeTab.label}
                </SWText>
              </PressableScale>
            </GlassSurface>
          </View>
          {onSnap ? (
            <View style={[styles.shadow, styles.capsuleSlot]}>
              <GlassSurface style={styles.foldedSnap}>
                <SnapRow compact onPress={onSnap} />
              </GlassSurface>
            </View>
          ) : (
            <View style={styles.capsuleSlot} />
          )}
          {search('folded')}
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={dockStyle}>
      {onSnap ? (
        <View style={[styles.shadow, styles.snapSlot]}>
          <GlassSurface style={styles.snapBar}>
            <SnapRow compact={false} onPress={onSnap} />
          </GlassSurface>
        </View>
      ) : null}
      <View style={styles.bottomRow}>
        <View style={[styles.shadow, styles.capsuleSlot]}>
          <GlassSurface style={styles.capsule}>
            <View accessibilityRole="tablist" style={styles.row}>
              <Animated.View pointerEvents="none" style={[styles.pill, pillStyle]} />
              {tabs.map(renderTab)}
            </View>
          </GlassSurface>
        </View>
        {search('regular')}
      </View>
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

/** The folded bar's height: one row of the open tab, a compact Snap and search. */
const foldedHeight = 52;

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
  shadow: {
    borderRadius: tokens.radius.full,
    shadowColor: tokens.lifted[name],
    shadowOpacity: 1,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
  },
  // The Snap bar and the row below it share one width, like iOS's accessory and tab bar.
  snapSlot: {
    width: '100%',
    maxWidth: tokens.layout.phoneColumn - tokens.spacing[8],
  },
  snapBar: {
    borderRadius: tokens.radius.full,
    paddingVertical: tokens.spacing[1],
  },
  bottomRow: {
    width: '100%',
    maxWidth: tokens.layout.phoneColumn - tokens.spacing[8],
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  capsuleSlot: {
    flex: 1,
  },
  searchCircle: {
    width: tokens.layout.floatingTabBar,
    height: tokens.layout.floatingTabBar,
    borderRadius: tokens.radius.full,
  },
  searchButton: {
    width: tokens.layout.floatingTabBar,
    height: tokens.layout.floatingTabBar,
    alignItems: 'center',
    justifyContent: 'center',
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
  foldedTab: {
    height: foldedHeight,
    borderRadius: tokens.radius.full,
  },
  foldedTabFace: {
    height: foldedHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.spacing[4],
  },
  foldedSnap: {
    height: foldedHeight,
    borderRadius: tokens.radius.full,
    justifyContent: 'center',
  },
  foldedCircle: {
    width: foldedHeight,
    height: foldedHeight,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
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
}));
