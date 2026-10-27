import { useState } from 'react';
import { View, Alert } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import {
  Button,
  Field,
  PlaceHero,
  PressableScale,
  Reveal,
  Screen,
  SegmentedControl,
  Surface,
  SWText,
  TextField,
  Wordmark,
  Worthy,
} from '../../components';
import {
  placeColors,
  themedStyles,
  tokens,
  useTheme,
  useThemedStyles,
  useWideLayout,
} from '../../design';

export type AuthMode = 'login' | 'signup';

export interface AuthInput {
  readonly mode: AuthMode;
  readonly email: string;
  readonly password: string;
  readonly fullName?: string;
  readonly gender?: string;
}

export interface LoginViewProps {
  readonly initialMode?: AuthMode;
  readonly onSubmit?: (input: AuthInput) => void;
  readonly onForgotPassword?: () => void;
  readonly onContinueWithApple?: () => void;
  readonly onContinueWithGoogle?: () => void;
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
  const { colors } = useTheme();
  const brand = placeColors(colors, 'feed');

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const text = copy[mode];
  // On a wide window the colour block and the form sit side by side, so it all fits at once.
  const wide = useWideLayout();
  const half = wide ? styles.half : null;

  const submit = () => {
    if (submitting) return;

    if (mode === 'signup' && password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      onSubmit?.({ mode, email, password, fullName, gender });
    }, 900);
  };

  const continueWithApple = () =>
    onContinueWithApple ? onContinueWithApple() : onSubmit?.({ mode, email, password });
  const continueWithGoogle = () =>
    onContinueWithGoogle ? onContinueWithGoogle() : onSubmit?.({ mode, email, password });

  return (
    <Screen
      place="feed"
      ambient="feed"
      quiet
      width="wide"
      contentStyle={[styles.content, wide ? styles.contentCentred : null]}
    >
      <View style={wide ? styles.split : null}>
        <PlaceHero title={text.title} style={wide ? styles.heroSide : null}>
          <Reveal index={0} style={styles.brand}>
            <Wordmark ink={brand.ink} lensColor={brand.lens} />
            {onClose ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Not now. Keep looking around"
                haptic="select"
                onPress={onClose}
                hitSlop={tokens.spacing[2]}
                style={styles.close}
              >
                <SWText variant="label" color={brand.ink}>
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
              <SWText variant="displayHero" color={brand.ink} accessibilityRole="header">
                {text.title}
              </SWText>
              <SWText variant="bodyLarge" color={brand.ink}>
                {text.why}
              </SWText>
            </Animated.View>
            <View style={[styles.worthy, { backgroundColor: colors.marigold }]}>
              <Worthy size={84} mood="attentive" />
            </View>
          </Reveal>
        </PlaceHero>

        <Reveal index={2} style={wide ? styles.formSide : null}>
          <Surface padding={tokens.spacing[5]} contentStyle={styles.card}>
            <View style={styles.quick}>
              <View style={wide ? styles.pair : styles.quick}>
                <Button
                  label="Continue with Apple"
                  onPress={continueWithApple}
                  containerStyle={half}
                />
                <Button
                  label="Continue with Google"
                  variant="secondary"
                  onPress={continueWithGoogle}
                  containerStyle={half}
                />
              </View>
              <View style={styles.or}>
                <View style={styles.rule} />
                <SWText variant="caption" tone="textMuted">
                  or use email
                </SWText>
                <View style={styles.rule} />
              </View>
            </View>

            <View style={styles.form}>
              <SegmentedControl options={modes} value={mode} onChange={setMode} />

              <View style={[styles.fields, wide ? styles.pair : null]}>
                <View style={half}>
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
                </View>
                <View style={half}>
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
                </View>

                {mode === 'signup' ? (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(140)}
                    style={[styles.signupFields, wide ? styles.pairFull : null]}
                  >
                    <View style={half}>
                      <Field label="Confirm Password">
                        <TextField
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          placeholder="Repeat your password"
                          secureTextEntry
                          textContentType="newPassword"
                          accessibilityLabel="Confirm Password"
                        />
                      </Field>
                    </View>
                    <View style={half}>
                      <Field label="Full Name">
                        <TextField
                          value={fullName}
                          onChangeText={setFullName}
                          placeholder="e.g. John Doe"
                          autoCapitalize="words"
                          textContentType="name"
                          accessibilityLabel="Full Name"
                        />
                      </Field>
                    </View>
                    <View style={half}>
                      <Field label="Gender">
                        <TextField
                          value={gender}
                          onChangeText={setGender}
                          placeholder="e.g. Male, Female, Other"
                          accessibilityLabel="Gender"
                        />
                      </Field>
                    </View>
                  </Animated.View>
                ) : null}

                {mode === 'login' ? (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(140)}
                    style={wide ? styles.pairFull : null}
                  >
                    <Button
                      label="Forgot password?"
                      variant="tertiary"
                      onPress={onForgotPassword}
                      containerStyle={styles.forgot}
                    />
                  </Animated.View>
                ) : null}
              </View>
            </View>

            <Button label={text.submit} variant="secondary" loading={submitting} onPress={submit} />
          </Surface>
        </Reveal>
      </View>
    </Screen>
  );
}

const stylesFor = themedStyles((colors) => ({
  content: {
    paddingTop: tokens.spacing[2],
  },
  split: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: tokens.spacing[8],
    paddingTop: tokens.spacing[6],
  },
  // The wordmark at the panel's head and the welcome at its foot, as on the phone's block.
  heroSide: {
    flex: 5,
    minWidth: 0,
    justifyContent: 'space-between',
  },
  // The pair sits in the middle of the window rather than hanging from its top.
  contentCentred: {
    justifyContent: 'center',
  },
  formSide: {
    flex: 6,
    minWidth: 0,
  },
  // Fields and buttons two to a row on a wide window.
  pair: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.spacing[4],
    rowGap: tokens.spacing[4],
  },
  pairFull: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.spacing[4],
    rowGap: tokens.spacing[4],
  },
  half: {
    flexBasis: '45%',
    flexGrow: 1,
    minWidth: 0,
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
    marginTop: tokens.spacing[8],
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tokens.spacing[2],
  },
  introText: {
    flex: 1,
    gap: tokens.spacing[3],
  },
  worthy: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    gap: tokens.spacing[6],
  },
  quick: {
    gap: tokens.spacing[3],
  },
  form: {
    gap: tokens.spacing[6],
  },
  fields: {
    gap: tokens.spacing[4],
  },
  signupFields: {
    gap: tokens.spacing[4],
  },
  forgot: {
    alignSelf: 'flex-end',
    marginTop: -tokens.spacing[2],
    marginRight: -tokens.spacing[2],
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
