import { View, type StyleProp, type ViewStyle } from 'react-native';

import { held, themedStyles, tokens, useThemedStyles } from '../design';
import { SWText } from './SWText';
import { Worthy } from './Worthy';

/**
 * One line from Worthy, in the appraiser's voice: something useful about this item that the
 * numbers alone don't say. One per screen at most, and never small talk.
 */
export function WorthySays({
  children,
  style,
}: {
  readonly children: string;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(stylesFor);
  return (
    <View style={[styles.row, style]} accessible accessibilityLabel={`Worthy says: ${children}`}>
      <Worthy size={52} mood="attentive" />
      <View style={styles.bubble}>
        <SWText variant="bodyMedium">{children}</SWText>
      </View>
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tokens.spacing[2],
  },
  // A speech bubble whose tail is the square corner nearest Worthy.
  bubble: {
    flex: 1,
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
    borderRadius: tokens.radius.large,
    borderBottomLeftRadius: 4,
    backgroundColor: colors.surface,
    ...held(colors, 2),
  },
}));
