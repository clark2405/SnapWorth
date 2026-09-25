import { ChevronDown } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Platform, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  themedStyles,
  tokens,
  useTheme,
  useThemedStyles,
  type TypographyStyleName,
} from '../design';
import { PressableScale } from './PressableScale';
import { SWText, typeStyle } from './SWText';

/**
 * Browsers draw their own focus outline on text fields; the field border shows focus instead.
 * Native platforms have no such outline, so this is empty there.
 */
export const hideWebFocusOutline: TextStyle =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : {};

export interface FieldProps {
  readonly label?: string;
  readonly helper?: string;
  readonly children: ReactNode;
}

/** A label above a control, with optional helper text below. */
export function Field({ label, helper, children }: FieldProps) {
  const styles = useThemedStyles(stylesFor);
  return (
    <View style={styles.field}>
      {label ? (
        <SWText variant="labelSmall" tone="textSecondary" style={styles.fieldLabel}>
          {label}
        </SWText>
      ) : null}
      {children}
      {helper ? (
        <SWText variant="caption" tone="textMuted" style={styles.fieldLabel}>
          {helper}
        </SWText>
      ) : null}
    </View>
  );
}

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  readonly prefix?: string;
  readonly size?: 'regular' | 'large';
  /** Leading glyph, e.g. a search icon. */
  readonly leading?: ReactNode;
}

/**
 * A filled field. Focus is shown by the edge warming to the accent and the well lifting a step,
 * both eased over 180ms so the change reads as attention, not a flicker.
 */
export function TextField({
  prefix,
  size = 'regular',
  leading,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const focus = useSharedValue(0);
  const textVariant: TypographyStyleName = size === 'large' ? 'priceLarge' : 'bodyLarge';

  const boxStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [colors.sunken, colors.focusRing]),
    backgroundColor: interpolateColor(focus.value, [0, 1], [colors.sunken, colors.surface]),
  }));

  return (
    <Animated.View style={[styles.box, size === 'large' ? styles.large : null, boxStyle]}>
      {leading}
      {prefix ? (
        <SWText variant={textVariant} tone="textMuted">
          {prefix}
        </SWText>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        keyboardAppearance={isDark ? 'dark' : 'light'}
        onFocus={(event) => {
          focus.value = withTiming(1, { duration: 180 });
          onFocus?.(event);
        }}
        onBlur={(event) => {
          focus.value = withTiming(0, { duration: 180 });
          onBlur?.(event);
        }}
        style={[
          styles.input,
          hideWebFocusOutline,
          typeStyle(textVariant),
          { color: colors.textPrimary, lineHeight: undefined },
          size === 'large' ? styles.tabular : null,
        ]}
        {...rest}
      />
    </Animated.View>
  );
}

export interface SelectFieldProps {
  readonly value: string;
  readonly accessibilityLabel: string;
  readonly onPress?: () => void;
}

/** A field that opens a picker. */
export function SelectField({ value, accessibilityLabel, onPress }: SelectFieldProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  return (
    <PressableScale
      accessibilityLabel={`${accessibilityLabel}: ${value}`}
      onPress={onPress}
      haptic="select"
      depth="surface"
      style={({ pressed }) => [styles.box, styles.select, pressed ? styles.pressed : null]}
    >
      <SWText variant="bodyLarge" style={styles.selectValue}>
        {value}
      </SWText>
      <ChevronDown size={18} strokeWidth={2} color={colors.textMuted} />
    </PressableScale>
  );
}

const stylesFor = themedStyles((colors) => ({
  field: {
    gap: tokens.spacing[2],
  },
  fieldLabel: {
    paddingHorizontal: tokens.spacing[1],
  },
  box: {
    minHeight: tokens.layout.controlHeight,
    borderRadius: tokens.radius.medium,
    borderWidth: 1.5,
    borderColor: colors.sunken,
    backgroundColor: colors.sunken,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing[4],
    gap: tokens.spacing[2],
  },
  large: {
    minHeight: tokens.spacing[16] + tokens.spacing[2],
  },
  pressed: {
    backgroundColor: colors.borderSubtle,
  },
  input: {
    flex: 1,
    alignSelf: 'stretch',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  select: {
    justifyContent: 'space-between',
  },
  selectValue: {
    flex: 1,
  },
}));
