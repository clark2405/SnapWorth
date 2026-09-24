import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  Field,
  Reveal,
  Screen,
  SegmentedControl,
  SWText,
  TextField,
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
  { key: 'login', label: 'Log in' },
  { key: 'signup', label: 'Sign up' },
] as const;

const copy = {
  login: {
    title: 'Welcome back.',
    subtitle: 'Your history, votes, and listings are where you left them.',
    submit: 'Log in',
  },
  signup: {
    title: 'Start with one photo.',
    subtitle: 'An email and a password. Nothing else until you need it.',
    submit: 'Create account',
  },
} as const;

export function LoginView({
  initialMode = 'login',
  onSubmit,
  onForgotPassword,
  onContinueWithGoogle,
}: LoginViewProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const text = copy[mode];

  return (
    <Screen contentStyle={styles.content}>
      <Reveal index={0} style={styles.brand}>
        <SWText variant="wordmark">SnapWorth</SWText>
      </Reveal>

      <Reveal index={1} style={styles.intro}>
        <SWText variant="displayHero" accessibilityRole="header">
          {text.title}
        </SWText>
        <SWText variant="bodyLarge" tone="textSecondary">
          {text.subtitle}
        </SWText>
      </Reveal>

      <Reveal index={2} style={styles.form}>
        <SegmentedControl options={modes} value={mode} onChange={setMode} />

        <View style={styles.fields}>
          <Field label="Email">
            <TextField
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              accessibilityLabel="Email address"
            />
          </Field>
          <Field label="Password">
            <TextField
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'}
              secureTextEntry
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              textContentType={mode === 'login' ? 'password' : 'newPassword'}
              accessibilityLabel="Password"
            />
          </Field>
          {mode === 'login' ? (
            <Button
              label="Forgot password?"
              variant="tertiary"
              onPress={onForgotPassword}
              containerStyle={styles.forgot}
            />
          ) : null}
        </View>
      </Reveal>

      <Reveal index={3} style={styles.actions}>
        <Button label={text.submit} onPress={() => onSubmit?.({ mode, email, password })} />
        <View style={styles.or}>
          <View style={styles.rule} />
          <SWText variant="caption" tone="textMuted">
            or
          </SWText>
          <View style={styles.rule} />
        </View>
        <Button label="Continue with Google" variant="secondary" onPress={onContinueWithGoogle} />
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: tokens.spacing[4],
  },
  brand: {
    minHeight: tokens.layout.headerHeight,
    justifyContent: 'center',
  },
  intro: {
    marginTop: tokens.spacing[10],
    gap: tokens.spacing[3],
  },
  form: {
    marginTop: tokens.spacing[10],
    gap: tokens.spacing[6],
  },
  fields: {
    gap: tokens.spacing[4],
  },
  forgot: {
    alignSelf: 'flex-end',
    marginTop: -tokens.spacing[2],
    marginRight: -tokens.spacing[2],
  },
  actions: {
    marginTop: tokens.spacing[8],
    gap: tokens.spacing[4],
  },
  or: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  rule: {
    flex: 1,
    height: tokens.border.hairline,
    backgroundColor: tokens.color.dark.borderSubtle,
  },
});
