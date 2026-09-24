import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '../design';

export interface ScreenProps {
  readonly children: ReactNode;
  /** Pinned above the scroll area (headers). */
  readonly header?: ReactNode;
  /** Pinned below the scroll area (composers, action sheets). */
  readonly footer?: ReactNode;
  readonly scroll?: boolean;
  /** Extra bottom room so content can scroll clear of the docked tab bar. */
  readonly clearTabBar?: boolean;
  readonly contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Every screen sits on the flat ink canvas inside a phone-width column, centred on wider
 * viewports until the responsive shell lands.
 */
export function Screen({
  children,
  header,
  footer,
  scroll = true,
  clearTabBar = false,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomRoom = clearTabBar
    ? tokens.layout.tabBarHeight + insets.bottom + tokens.spacing[8]
    : tokens.spacing[6] + (footer ? 0 : insets.bottom);

  const body = [styles.content, { paddingBottom: bottomRoom }, contentStyle];

  return (
    <View style={styles.root}>
      <View style={[styles.column, { paddingTop: header ? 0 : insets.top }]}>
        {header ? <View style={{ paddingTop: insets.top }}>{header}</View> : null}
        {scroll ? (
          <ScrollView
            style={styles.fill}
            contentContainerStyle={body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.fill, body]}>{children}</View>
        )}
        {footer ? <View style={{ paddingBottom: insets.bottom }}>{footer}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.color.dark.canvas,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: tokens.layout.phoneColumn,
    alignSelf: 'center',
  },
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: tokens.layout.pageGutterCompact,
    flexGrow: 1,
  },
});
