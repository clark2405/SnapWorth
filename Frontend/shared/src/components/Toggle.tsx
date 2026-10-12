import { Platform, Switch, type SwitchProps } from 'react-native';

import { useTheme } from '../design';

/**
 * The on/off switch, in ink rather than the platform's green. In dark mode the ink turns to
 * cream, which a white thumb disappears into, so "on" takes the accent there instead. Off is the
 * interactive-boundary grey, which keeps 3:1 against a card in both themes; the system's pale
 * off track all but vanishes on white. Native thumbs keep their own white; the web's would turn
 * teal when on, so it gets the canvas colour.
 */
export function Toggle(props: Omit<SwitchProps, 'trackColor' | 'thumbColor'>) {
  const { colors, isDark } = useTheme();
  const web =
    Platform.OS === 'web' ? { activeThumbColor: isDark ? colors.onAccent : colors.canvas } : null;
  return (
    <Switch
      trackColor={{
        false: colors.interactiveBoundary,
        true: isDark ? colors.accent : colors.textPrimary,
      }}
      ios_backgroundColor={colors.interactiveBoundary}
      {...web}
      {...props}
    />
  );
}
