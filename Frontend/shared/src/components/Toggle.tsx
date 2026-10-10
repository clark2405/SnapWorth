import { Platform, Switch, type SwitchProps } from 'react-native';

import { useTheme } from '../design';

/**
 * The on/off switch, in ink rather than the platform's green. In dark mode the ink turns to
 * cream, which a white thumb disappears into, so "on" takes the accent there instead. Native
 * thumbs keep their own white; the web's would turn teal when on, so it gets the canvas colour.
 */
export function Toggle(props: Omit<SwitchProps, 'trackColor' | 'thumbColor'>) {
  const { colors, isDark } = useTheme();
  const web =
    Platform.OS === 'web' ? { activeThumbColor: isDark ? colors.onAccent : colors.canvas } : null;
  return (
    <Switch
      trackColor={{ false: colors.sunken, true: isDark ? colors.accent : colors.textPrimary }}
      {...web}
      {...props}
    />
  );
}
