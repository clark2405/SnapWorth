import type { LucideIcon } from 'lucide-react-native';
import { Search, UserRound } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Pressable,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  haptic,
  held,
  placeColors,
  themedStyles,
  tokens,
  useTheme,
  useThemedStyles,
  type Place,
} from '../design';
import { LogoMark, Wordmark } from './Brand';
import { SnapIcon } from './BrandIcons';
import { SWText } from './SWText';

export interface SideNavItem<Key extends string> {
  readonly key: Key;
  readonly label: string;
  readonly icon: LucideIcon;
  /** The place the tab opens on; the item takes its colour while it's the one you're in. */
  readonly place: Place;
}

export interface SideNavProps<Key extends string> {
  readonly items: readonly SideNavItem<Key>[];
  /** The place you're in, or the one the screen you're on was opened from. */
  readonly activeKey?: Key;
  readonly onSelect: (key: Key) => void;
  readonly onSnap?: () => void;
  readonly onSearch?: () => void;
  readonly onOpenProfile?: () => void;
  /** A narrow rail of icons alone, for screens with room for a rail but not a sidebar. */
  readonly rail?: boolean;
}

/**
 * The desktop's navigation: a sidebar down the left edge in place of the phone's floating tab
 * bar. The place you're in is cut from its own colour and held like a card, the same way each
 * tab's title opens on its colour block; Snap, the one action that matters everywhere, leads.
 */
export function SideNav<Key extends string>({
  items,
  activeKey,
  onSelect,
  onSnap,
  onSearch,
  onOpenProfile,
  rail = false,
}: SideNavProps<Key>) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();

  return (
    <View style={[styles.nav, rail ? styles.navRail : null]}>
      <View style={[styles.brand, rail ? styles.brandRail : null]}>
        {rail ? <LogoMark size={40} /> : <Wordmark height={26} />}
      </View>

      {onSnap ? (
        <NavPressable
          label="Snap it"
          hint="Photograph something to find out what it's worth"
          rail={rail}
          onPress={onSnap}
          style={[styles.snap, rail ? styles.snapRail : null]}
          hoverStyle={styles.snapHover}
        >
          <SnapIcon size={20} strokeWidth={2} color={colors.onAccent} />
          {rail ? null : (
            <SWText variant="button" color={colors.onAccent}>
              Snap it
            </SWText>
          )}
        </NavPressable>
      ) : null}

      <View accessibilityRole="tablist" style={styles.places}>
        {items.map((item) => {
          const active = item.key === activeKey;
          const place = placeColors(colors, item.place);
          const Icon = item.icon;
          return (
            <NavPressable
              key={item.key}
              label={item.label}
              role="tab"
              selected={active}
              rail={rail}
              onPress={() => {
                if (!active) haptic('select');
                onSelect(item.key);
              }}
              style={[
                styles.item,
                rail ? styles.itemRail : null,
                active ? [styles.itemActive, { backgroundColor: place.fill }] : null,
              ]}
              hoverStyle={active ? null : styles.itemHover}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2 : 1.75}
                color={active ? place.ink : colors.textSecondary}
              />
              {rail ? null : (
                <SWText
                  variant={active ? 'button' : 'label'}
                  color={active ? place.ink : colors.textSecondary}
                  style={styles.itemLabel}
                >
                  {item.label}
                </SWText>
              )}
            </NavPressable>
          );
        })}
      </View>

      <View style={styles.spacer} />

      <View style={styles.places}>
        {onSearch ? (
          <NavPressable
            label="Search"
            rail={rail}
            onPress={onSearch}
            style={[styles.item, rail ? styles.itemRail : null]}
            hoverStyle={styles.itemHover}
          >
            <Search size={22} strokeWidth={1.75} color={colors.textSecondary} />
            {rail ? null : (
              <SWText variant="label" color={colors.textSecondary} style={styles.itemLabel}>
                Search
              </SWText>
            )}
          </NavPressable>
        ) : null}
        {onOpenProfile ? (
          <NavPressable
            label="Profile and settings"
            rail={rail}
            onPress={onOpenProfile}
            style={[styles.item, rail ? styles.itemRail : null]}
            hoverStyle={styles.itemHover}
          >
            <UserRound size={22} strokeWidth={1.75} color={colors.textSecondary} />
            {rail ? null : (
              <SWText variant="label" color={colors.textSecondary} style={styles.itemLabel}>
                Profile
              </SWText>
            )}
          </NavPressable>
        ) : null}
      </View>
    </View>
  );
}

type HoverableState = PressableStateCallbackType & { readonly hovered?: boolean };

/** A sidebar row: lifts on hover and dips while pressed, as a desktop control should. */
function NavPressable({
  label,
  hint,
  role = 'button',
  selected,
  rail,
  onPress,
  style,
  hoverStyle,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly role?: 'button' | 'tab';
  readonly selected?: boolean;
  readonly rail: boolean;
  readonly onPress: () => void;
  readonly style: StyleProp<ViewStyle>;
  readonly hoverStyle: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}) {
  const styles = useThemedStyles(stylesFor);
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={role === 'tab' ? { selected: Boolean(selected) } : undefined}
      // The rail shows icons alone, so the name appears on hover instead.
      {...(rail ? { title: label } : null)}
      onPress={onPress}
      style={(state) => [
        style,
        (state as HoverableState).hovered ? hoverStyle : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

const railWidth = tokens.layout.navigationRailCompact;
const sidebarWidth = tokens.layout.navigationRailExpanded;

const stylesFor = themedStyles((colors) => ({
  nav: {
    width: sidebarWidth,
    height: '100%',
    paddingTop: tokens.spacing[6],
    paddingBottom: tokens.spacing[5],
    paddingHorizontal: tokens.spacing[4],
    gap: tokens.spacing[6],
    backgroundColor: colors.canvas,
    borderRightWidth: tokens.border.hairline,
    borderRightColor: colors.borderSubtle,
  },
  navRail: {
    width: railWidth,
    paddingHorizontal: tokens.spacing[3],
    alignItems: 'center',
  },
  brand: {
    height: tokens.layout.headerHeight,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[3],
  },
  brandRail: {
    paddingHorizontal: 0,
  },
  snap: {
    height: tokens.layout.controlHeight,
    borderRadius: tokens.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
    backgroundColor: colors.accent,
    ...held(colors, 3),
  },
  snapRail: {
    width: tokens.layout.controlHeight - tokens.spacing[1],
    height: tokens.layout.controlHeight - tokens.spacing[1],
  },
  snapHover: {
    backgroundColor: colors.accentPressed,
  },
  places: {
    gap: tokens.spacing[1],
  },
  item: {
    height: tokens.layout.controlHeight - tokens.spacing[1],
    borderRadius: tokens.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[4],
    // The same 2pt outline as the active item, kept clear, so nothing shifts when it fills.
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemRail: {
    width: tokens.layout.controlHeight - tokens.spacing[1],
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  itemActive: {
    ...held(colors, 2),
  },
  itemHover: {
    backgroundColor: colors.sunken,
  },
  itemLabel: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  spacer: {
    flex: 1,
  },
}));
