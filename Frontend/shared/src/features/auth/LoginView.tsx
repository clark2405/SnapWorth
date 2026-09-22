import { ChartColumnBig } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  GlassField,
  GlassInput,
  GlowButton,
  PressableScale,
  Reveal,
  Screen,
  SegmentedControl,
  SWText,
} from '../../components';
import { tokens } from '../../design';

export type AuthMode = 'login' | 'signup';

export interface LoginViewProps {
  readonly initialMode?: AuthMode;
  readonly onSubmit?: (input: { mode: AuthMode; email: string; password: string }) => void;
  readonly onForgotPassword?: () => void;
  readonly onContinueWithGoogle?: () => void;
}

const modes = [
  { key: 'login', label: 'Log In' },
  { key: 'signup', label: 'Sign Up' },
] as const;

export function LoginView({
  initialMode = 'login',
  onSubmit,
  onForgotPassword,
  onContinueWithGoogle,
}: LoginViewProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Screen contentStyle={styles.content}>
      <Reveal index={0} style={styles.brand}>
        <View style={styles.logo}>
          <ChartColumnBig size={30} strokeWidth={1.75} color={tokens.color.dark.accent} />
        </View>
        <SWText variant="wordmark" tone="textMuted">
          SnapWorth
        </SWText>
      </Reveal>

      <Reveal index={1}>
        <SWText variant="displayHero" align="center" accessibilityRole="header">
          Know what{'\n'}it&apos;s{' '}
          <SWText variant="displayHero" tone="accent">
            worth.
          </SWText>
        </SWText>
      </Reveal>

      <Reveal index={2} style={styles.form}>
        <SegmentedControl options={modes} value={mode} onChange={setMode} />

        <View style={styles.fields}>
          <GlassField label="Email Address">
            <GlassInput
              value={email}
              onChangeText={setEmail}
              placeholder="alex@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              accessibilityLabel="Email address"
            />
          </GlassField>
          <GlassField label="Password">
            <GlassInput
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              textContentType={mode === 'login' ? 'password' : 'newPassword'}
              accessibilityLabel="Password"
            />
          </GlassField>
        </View>

        {mode === 'login' ? (
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel="Forgot password?"
            onPress={onForgotPassword}
            containerStyle={styles.forgot}
          >
            <SWText variant="labelMedium" tone="accent">
              Forgot Password?
            </SWText>
          </PressableScale>
        ) : null}
      </Reveal>

      <Reveal index={3} style={styles.actions}>
        <GlowButton
          label={mode === 'login' ? 'Log In to SnapWorth' : 'Create My Account'}
          onPress={() => onSubmit?.({ mode, email, password })}
        />
        <GlowButton label="Continue with Google" variant="glass" onPress={onContinueWithGoogle} />
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: tokens.spacing[6],
    paddingTop: 112,
  },
  brand: {
    alignItems: 'center',
    gap: tokens.spacing[5],
    marginBottom: 10,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: tokens.radius.xlarge,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.glass.mintFillStrong,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.glass.mintBorder,
    boxShadow: tokens.glow.halo,
  },
  form: {
    marginTop: 52,
    gap: tokens.spacing[8],
  },
  fields: {
    gap: tokens.spacing[4],
  },
  forgot: {
    alignSelf: 'flex-end',
    marginTop: -tokens.spacing[5],
    minHeight: tokens.focus.minimumTarget,
    justifyContent: 'center',
  },
  actions: {
    marginTop: tokens.spacing[5],
    gap: tokens.spacing[4],
  },
});
