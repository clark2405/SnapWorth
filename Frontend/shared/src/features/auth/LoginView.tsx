import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import {
  Button,
  Field,
  Reveal,
  Screen,
  SegmentedControl,
  SWText,
  TextField,
} from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';

export type AuthMode = 'login' | 'signup';

export interface LoginViewProps {
  readonly initialMode?: AuthMode;
  readonly onSubmit?: (input: { mode: AuthMode; email: string; password: string }) => void;
  readonly onForgotPassword?: () => void;
  readonly onContinueWithApple?: () => void;
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
  onContinueWithApple,
  onContinueWithGoogle,
}: LoginViewProps) {
  const styles = useThemedStyles(stylesFor);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const text = copy[mode];

  const submit = () => {
    if (submitting) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      onSubmit?.({ mode, email, password });
    }, 900);
  };

  const continueWithApple = () =>
    onContinueWithApple ? onContinueWithApple() : onSubmit?.({ mode, email, password });
  const continueWithGoogle = () =>
    onContinueWithGoogle ? onContinueWithGoogle() : onSubmit?.({ mode, email, password });

  return (
    <Screen ambient="aurora" contentStyle={styles.content}>
      <Reveal index={0} style={styles.brand}>
        <SWText variant="wordmark">SnapWorth</SWText>
      </Reveal>

      <Reveal index={1} style={styles.intro}>
        <Animated.View
          key={mode}
          entering={FadeIn.duration(240)}
          exiting={FadeOut.duration(160)}
          layout={LinearTransition.springify().damping(20)}
          style={styles.introText}
        >
          <SWText variant="displayHero" accessibilityRole="header">
            {text.title}
          </SWText>
          <SWText variant="bodyLarge" tone="textSecondary">
            {text.subtitle}
          </SWText>
        </Animated.View>
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
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)}>
              <Button
                label="Forgot password?"
                variant="tertiary"
                onPress={onForgotPassword}
                containerStyle={styles.forgot}
              />
            </Animated.View>
          ) : null}
        </View>
      </Reveal>

      <Reveal index={3} style={styles.actions}>
        <Button label={text.submit} loading={submitting} onPress={submit} />
        <View style={styles.or}>
          <View style={styles.rule} />
          <SWText variant="caption" tone="textMuted">
            or
          </SWText>
          <View style={styles.rule} />
        </View>
        <Button label="Continue with Apple" variant="primary" onPress={continueWithApple} />
        <Button label="Continue with Google" variant="secondary" onPress={continueWithGoogle} />
      </Reveal>
    </Screen>
  );
}

const stylesFor = themedStyles((colors) => ({
  content: {
    paddingTop: tokens.spacing[4],
  },
  brand: {
    minHeight: tokens.layout.headerHeight,
    justifyContent: 'center',
  },
  intro: {
    marginTop: tokens.spacing[10],
  },
  introText: {
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
    backgroundColor: colors.borderSubtle,
  },
}));
