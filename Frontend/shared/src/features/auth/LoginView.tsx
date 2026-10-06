import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import {
  Button,
  Field,
  PressableScale,
  Reveal,
  Screen,
  SegmentedControl,
  SWText,
  TextField,
  Wordmark,
} from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';

export type AuthMode = 'login' | 'signup';

export interface LoginViewProps {
  readonly initialMode?: AuthMode;
  readonly onSubmit?: (input: { mode: AuthMode; email: string; password: string }) => void;
  readonly onForgotPassword?: () => void;
  readonly onContinueWithApple?: () => void;
  readonly onContinueWithGoogle?: () => void;
  /** Shown when the screen was opened from an account prompt, so a guest can change their mind. */
  readonly onClose?: () => void;
}

const modes = [
  { key: 'login', label: 'Log in' },
  { key: 'signup', label: 'Sign up' },
] as const;

const copy = {
  login: {
    title: 'Welcome back.',
    why: 'Pick up your items, listings and chats where you left them.',
    submit: 'Log in',
  },
  signup: {
    title: 'Start with one photo.',
    why: 'A free account lets you snap your own things, vote on prices and talk to sellers.',
    submit: 'Create account',
  },
} as const;

export function LoginView({
  initialMode = 'login',
  onSubmit,
  onForgotPassword,
  onContinueWithApple,
  onContinueWithGoogle,
  onClose,
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
    <Screen ambient="feed" contentStyle={styles.content}>
      <Reveal index={0} style={styles.brand}>
        <Wordmark />
        {onClose ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Not now. Keep looking around"
            haptic="select"
            onPress={onClose}
            hitSlop={tokens.spacing[2]}
            style={styles.close}
          >
            <SWText variant="label" tone="textSecondary">
              Not now
            </SWText>
          </PressableScale>
        ) : null}
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
            {text.why}
          </SWText>
        </Animated.View>
      </Reveal>

      {/* One tap first: Sign in with Apple is the fastest, most private way in, so it leads;
          email is there for anyone who prefers it. */}
      <Reveal index={2} style={styles.quick}>
        <Button label="Continue with Apple" onPress={continueWithApple} />
        <Button label="Continue with Google" variant="secondary" onPress={continueWithGoogle} />
        <View style={styles.or}>
          <View style={styles.rule} />
          <SWText variant="caption" tone="textMuted">
            or use email
          </SWText>
          <View style={styles.rule} />
        </View>
      </Reveal>

      <Reveal index={3} style={styles.form}>
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

      <Reveal index={4} style={styles.actions}>
        <Button label={text.submit} variant="secondary" loading={submitting} onPress={submit} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: {
    paddingVertical: tokens.spacing[2],
    paddingLeft: tokens.spacing[3],
  },
  intro: {
    marginTop: tokens.spacing[10],
  },
  introText: {
    gap: tokens.spacing[3],
  },
  quick: {
    marginTop: tokens.spacing[8],
    gap: tokens.spacing[3],
  },
  form: {
    marginTop: tokens.spacing[4],
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
    marginTop: tokens.spacing[6],
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
