import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { tokens } from '../design';
import { IconButton } from './IconButton';
import { Reveal } from './Reveal';
import { SWText } from './SWText';

export interface NavHeaderProps {
  readonly title: string;
  readonly onBack?: () => void;
  readonly trailing?: ReactNode;
  /** A glass band with a hairline beneath it, for screens whose content scrolls under the header. */
  readonly banded?: boolean;
}

/** Centred title with a back arrow, for detail and flow screens. */
export function NavHeader({ title, onBack, trailing, banded = false }: NavHeaderProps) {
  return (
    <View style={[styles.nav, banded ? styles.band : null]}>
      {banded ? (
        <LinearGradient
          pointerEvents="none"
          colors={[tokens.glass.highlight, tokens.glass.highlightClear]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
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
  readonly trailing?: ReactNode;
}

/** The editorial title that opens a top-level tab: Feed, Market, History. */
export function LargeTitle({ title, trailing }: LargeTitleProps) {
  return (
    <Reveal style={styles.large}>
      <SWText variant="displayTitle" accessibilityRole="header">
        {title}
      </SWText>
      {trailing}
    </Reveal>
  );
}

const styles = StyleSheet.create({
  nav: {
    height: tokens.layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing[2],
  },
  band: {
    backgroundColor: tokens.glass.fill,
    borderTopWidth: tokens.border.hairline,
    borderBottomWidth: tokens.border.hairline,
    borderColor: tokens.glass.borderStrong,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.spacing[5],
    paddingBottom: tokens.spacing[5],
  },
});
