import { ChevronDown } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
} from 'react-native';

import { tokens, type TypographyStyleName } from '../design';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';

/**
 * Browsers draw their own focus outline on text fields; the glass border shows focus instead.
 * Native platforms have no such outline, so this is empty there.
 */
export const hideWebFocusOutline: TextStyle =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : {};

export interface GlassFieldProps {
  readonly label?: string;
  readonly helper?: string;
  readonly children: ReactNode;
}

/** A label above a control, with optional helper text below. */
export function GlassField({ label, helper, children }: GlassFieldProps) {
  return (
    <View style={styles.field}>
      {label ? <SWText variant="label">{label}</SWText> : null}
      {children}
      {helper ? (
        <SWText variant="caption" tone="textMuted">
          {helper}
        </SWText>
      ) : null}
    </View>
  );
}

export interface GlassInputProps extends Omit<TextInputProps, 'style'> {
  readonly prefix?: string;
  readonly size?: 'regular' | 'large';
}

export function GlassInput({
  prefix,
  size = 'regular',
  onFocus,
  onBlur,
  ...rest
}: GlassInputProps) {
  const [focused, setFocused] = useState(false);
  const textVariant: TypographyStyleName = size === 'large' ? 'headingMedium' : 'bodyMedium';
  const text = tokens.typography.style[textVariant];

  return (
    <View
      style={[styles.box, size === 'large' ? styles.large : null, focused ? styles.focused : null]}
    >
      {prefix ? <SWText variant={textVariant}>{prefix}</SWText> : null}
      <TextInput
        placeholderTextColor={tokens.color.dark.textMuted}
        selectionColor={tokens.color.dark.accent}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          hideWebFocusOutline,
          {
            fontFamily: size === 'large' ? tokens.typography.family.bodyRegular : text.family,
            fontSize: text.size,
          },
        ]}
        {...rest}
      />
    </View>
  );
}

export interface GlassSelectProps {
  readonly value: string;
  readonly accessibilityLabel: string;
  readonly onPress?: () => void;
}

/** A closed select that shows its value and a chevron; the picker itself opens elsewhere. */
export function GlassSelect({ value, accessibilityLabel, onPress }: GlassSelectProps) {
  return (
    <PressableScale
      accessibilityLabel={`${accessibilityLabel}: ${value}`}
      onPress={onPress}
      style={[styles.box, styles.select]}
    >
      <SWText variant="bodyMedium" style={styles.selectValue}>
        {value}
      </SWText>
      <ChevronDown size={18} strokeWidth={2} color={tokens.color.dark.textSecondary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: tokens.spacing[2],
  },
  box: {
    minHeight: tokens.layout.inputHeight,
    borderRadius: tokens.radius.medium,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.glass.border,
    backgroundColor: tokens.glass.fill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing[4],
    gap: tokens.spacing[2],
  },
  large: {
    minHeight: 56,
  },
  focused: {
    borderColor: tokens.glass.mintBorder,
    backgroundColor: tokens.glass.fillRaised,
  },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    color: tokens.color.dark.textPrimary,
  },
  select: {
    justifyContent: 'space-between',
  },
  selectValue: {
    flex: 1,
  },
});
