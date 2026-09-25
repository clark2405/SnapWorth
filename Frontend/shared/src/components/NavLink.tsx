import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { PressableScale } from './PressableScale';

export interface NavLinkMenuItem {
  readonly title: string;
  /** SF Symbol name for the iOS context menu, e.g. "heart". */
  readonly symbol?: string;
  readonly destructive?: boolean;
  readonly onPress: () => void;
}

export interface NavLinkRenderProps {
  readonly href: string;
  readonly label: string;
  readonly style?: StyleProp<ViewStyle>;
  /** Layout for the outer pressable, e.g. `{ flex: 1 }` to fill a row. */
  readonly containerStyle?: StyleProp<ViewStyle>;
  readonly menu?: readonly NavLinkMenuItem[];
  readonly children: ReactNode;
}

interface NavLinkBridge {
  /** Renders a card that navigates with the platform's richest transition. */
  readonly link?: (props: NavLinkRenderProps) => ReactElement;
  /** Marks the element a zoom transition lands on in the destination screen. */
  readonly target?: (children: ReactNode) => ReactElement;
}

const NavLinkContext = createContext<NavLinkBridge>({});

/**
 * The app shell supplies the platform's navigation primitives here. On iOS that is a zoom
 * transition from the card into its detail screen, a long-press preview, and a context menu;
 * elsewhere cards fall back to a plain press that calls `onPress`.
 */
export function NavLinkProvider({
  link,
  target,
  children,
}: NavLinkBridge & { readonly children: ReactNode }) {
  const value = useMemo(() => ({ link, target }), [link, target]);
  return <NavLinkContext.Provider value={value}>{children}</NavLinkContext.Provider>;
}

export interface ZoomLinkProps {
  /** The destination, shared by web and mobile routes, e.g. `/listing/abc`. */
  readonly href: string;
  readonly label: string;
  /** Used where the platform has no link bridge (the web), or for analytics. */
  readonly onPress?: () => void;
  readonly menu?: readonly NavLinkMenuItem[];
  readonly style?: StyleProp<ViewStyle>;
  /** Layout for the outer pressable, e.g. `{ flex: 1 }` to fill a row. */
  readonly containerStyle?: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}

/** A card that opens its detail screen; on iOS it zooms into it and peeks on long-press. */
export function ZoomLink({
  href,
  label,
  onPress,
  menu,
  style,
  containerStyle,
  children,
}: ZoomLinkProps) {
  const { link } = useContext(NavLinkContext);
  if (link) return link({ href, label, style, containerStyle, menu, children });
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={label}
      depth="surface"
      haptic="none"
      onPress={onPress}
      style={style}
      containerStyle={containerStyle}
    >
      {children}
    </PressableScale>
  );
}

/** The element in a detail screen that an incoming zoom transition lands on. */
export function ZoomTarget({ children }: { readonly children: ReactNode }) {
  const { target } = useContext(NavLinkContext);
  return target ? target(children) : <>{children}</>;
}
