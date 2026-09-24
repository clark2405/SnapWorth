import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { tokens } from '../design';
import { IconButton } from './IconButton';
import { SWText } from './SWText';

export interface NavHeaderProps {
  readonly title: string;
  readonly onBack?: () => void;
  readonly trailing?: ReactNode;
  /** A hairline beneath the header, for screens whose content scrolls under it. */
  readonly banded?: boolean;
}

/** Centred title with a back arrow, for detail and flow screens. */
export function NavHeader({ title, onBack, trailing, banded = false }: NavHeaderProps) {
  return (
    <View style={[styles.nav, banded ? styles.band : null]}>
      <View style={styles.side}>
        {onBack ? <IconButton icon={ArrowLeft} label="Go back" onPress={onBack} /> : null}
      </View>
      <SWText
        variant="headingMedium"
        accessibilityRole="header"
        numberOfLines={1}
        style={styles.title}
      >
        {title}
      </SWText>
      <View style={[styles.side, styles.trailing]}>{trailing}</View>
    </View>
  );
}

export interface LargeTitleProps {
  readonly title: string;
  /** A short line under the title that states what the screen is for. */
  readonly subtitle?: string;
  readonly trailing?: ReactNode;
}

/**
 * The editorial title that opens a top-level tab: Feed, Market, History. Set left and tight,
 * with a quiet subtitle as its counterweight. It is part of the shell, so it does not animate.
 */
export function LargeTitle({ title, subtitle, trailing }: LargeTitleProps) {
  return (
    <View style={styles.large}>
      <View style={styles.largeText}>
        <SWText variant="displayTitle" accessibilityRole="header">
          {title}
        </SWText>
        {subtitle ? (
          <SWText variant="bodySmall" tone="textMuted">
            {subtitle}
          </SWText>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    minHeight: tokens.layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing[2],
  },
  band: {
    borderBottomWidth: tokens.border.hairline,
    borderColor: tokens.color.dark.borderSubtle,
  },
  side: {
    width: tokens.focus.minimumTarget + tokens.spacing[2],
    alignItems: 'flex-start',
  },
  trailing: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  large: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
    paddingTop: tokens.spacing[6],
    paddingBottom: tokens.spacing[6],
  },
  largeText: {
    flex: 1,
    gap: tokens.spacing[1],
  },
});
