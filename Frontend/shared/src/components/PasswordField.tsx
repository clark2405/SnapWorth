import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';

import { tokens, useTheme } from '../design';
import { PressableScale } from './PressableScale';
import { TextField, type TextFieldProps } from './TextField';

/**
 * A password field with a button at its end that shows what's been typed, so a long password
 * can be checked before it's sent. It starts hidden, and the button says which way it will go.
 */
export function PasswordField(props: Omit<TextFieldProps, 'secureTextEntry' | 'trailing'>) {
  const { colors } = useTheme();
  const [shown, setShown] = useState(false);
  const Icon = shown ? EyeOff : Eye;
  return (
    <TextField
      {...props}
      secureTextEntry={!shown}
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Hide password' : 'Show password'}
          haptic="select"
          hitSlop={tokens.spacing[2]}
          onPress={() => setShown((current) => !current)}
          style={{ padding: tokens.spacing[1] }}
        >
          <Icon size={20} strokeWidth={1.75} color={colors.textMuted} />
        </PressableScale>
      }
    />
  );
}
