import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, StyleSheet } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { PressableScale, type NavLinkRenderProps } from '@snapworth/shared/components';

/**
 * iOS: cards zoom into their detail screen (the system's fluid zoom transition), and a
 * long-press peeks at the destination with a context menu. Android falls back to a press.
 */
export function renderNavLink({
  href,
  label,
  style,
  containerStyle,
  menu,
  zoomFromSource,
  children,
}: NavLinkRenderProps) {
  // `Link asChild` hands its child's props to a Slot, which rejects style arrays, so callers'
  // composed styles (e.g. a row plus a divider) are flattened into one object first.
  const card = (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={label}
      depth="surface"
      haptic="none"
      style={StyleSheet.flatten(style)}
      containerStyle={StyleSheet.flatten(containerStyle)}
    >
      {children}
    </PressableScale>
  );

  if (Platform.OS !== 'ios') {
    return (
      <Link href={href as Href} asChild>
        {card}
      </Link>
    );
  }

  return (
    <Link href={href as Href} asChild>
      {/* With a ZoomSource inside, the zoom starts there (the photo) instead of the card. */}
      <Link.Trigger withAppleZoom={!zoomFromSource}>{card}</Link.Trigger>
      <Link.Preview />
      {menu && menu.length > 0 ? (
        <Link.Menu>
          {menu.map((item) => (
            <Link.MenuAction
              key={item.title}
              title={item.title}
              icon={item.symbol as SFSymbol | undefined}
              destructive={item.destructive}
              onPress={item.onPress}
            />
          ))}
        </Link.Menu>
      ) : null}
    </Link>
  );
}

export function renderZoomSource(children: ReactNode) {
  if (Platform.OS !== 'ios') return <>{children}</>;
  return <Link.AppleZoom>{children}</Link.AppleZoom>;
}

export function renderZoomTarget(children: ReactNode) {
  if (Platform.OS !== 'ios') return <>{children}</>;
  return <Link.AppleZoomTarget>{children}</Link.AppleZoomTarget>;
}
