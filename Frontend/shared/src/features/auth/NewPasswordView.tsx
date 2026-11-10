import { KeyRound, Link2Off, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import Animated from 'react-native-reanimated';

import {
  Button,
  Field,
  NavHeader,
  PasswordField,
  Reveal,
  Screen,
  stampIn,
  SWText,
} from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import {
  minimumPasswordLength,
  type NewPasswordOutcome,
  type RecoveryLinkStatus,
} from './password-reset';

export interface NewPasswordViewProps {
  /** What the reset link turned out to be (see `useRecoveryLink`). */
  readonly link: RecoveryLinkStatus;
  readonly onSave?: (password: string) => Promise<NewPasswordOutcome> | NewPasswordOutcome;
  /** Checks the link again after it couldn't be reached. */
  readonly onRetry?: () => void;
  readonly onRequestNewLink?: () => void;
  readonly onBackToLogin?: () => void;
  /** Goes on into the app once the new password is saved. */
  readonly onDone?: () => void;
}

/** What a link that can't be used says, and whether a new link would help. */
const stopped: Record<
  'expired' | 'invalid' | 'failed' | 'unavailable',
  { readonly title: string; readonly body: string }
> = {
  expired: {
    title: 'This link has expired.',
    body: 'Reset links last an hour and work once. Ask for a new one, then open the newest email.',
  },
  invalid: {
    title: 'This link doesn’t work.',
    body: 'It isn’t a complete reset link. Open the newest reset email again, or ask for a new link.',
  },
  failed: {
    title: 'We couldn’t check your link.',
    body: 'Check your connection and try again. The link still works until it expires.',
  },
  unavailable: {
    title: 'Password reset isn’t available.',
    body: 'This build isn’t connected to the SnapWorth server, so accounts live on this device only and have no password to reset.',
  },
};

const saveRefusals: Record<Exclude<NewPasswordOutcome, 'saved' | 'expired'>, string> = {
  same: 'That’s the password you have now. Choose a different one.',
  weak: 'That password is too easy to guess. Try a longer one.',
  failed: 'Your password couldn’t be saved. Check your connection and try again.',
};

export function NewPasswordView({
  link,
  onSave,
  onRetry,
  onRequestNewLink,
  onBackToLogin,
  onDone,
}: NewPasswordViewProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Saving can find the link's session gone, which stops the form like an expired link.
  const [outcome, setOutcome] = useState<'saved' | 'expired' | null>(null);

  const long = password.length >= minimumPasswordLength;
  const matches = password === confirmation;

  const save = async () => {
    if (saving) return;
    if (!long) {
      setProblem(`Use at least ${minimumPasswordLength} characters.`);
      return;
    }
    if (!matches) {
      setProblem('The two passwords don’t match.');
      return;
    }
    setSaving(true);
    setProblem(null);
    const result = onSave ? await onSave(password) : 'saved';
    setSaving(false);
    if (result === 'saved' || result === 'expired') setOutcome(result);
    else setProblem(saveRefusals[result]);
  };

  const header = <NavHeader title="" onBack={onBackToLogin} />;

  if (outcome === 'saved') {
    return (
      <Screen ambient="calm" quiet header={header} contentStyle={styles.content}>
        <Reveal index={0} style={styles.intro}>
          <Animated.View entering={stampIn} style={styles.icon}>
            <ShieldCheck size={24} strokeWidth={1.75} color={colors.success} />
          </Animated.View>
          <SWText variant="displayHero" accessibilityRole="header">
            Password changed.
          </SWText>
          <SWText variant="bodyLarge" tone="textSecondary" accessibilityLiveRegion="polite">
            You’re signed in. Use the new password next time you log in.
          </SWText>
        </Reveal>
        <Reveal index={1} style={styles.actions}>
          <Button label="Continue" onPress={onDone} />
        </Reveal>
      </Screen>
    );
  }

  const status = outcome ?? link;
  if (status === 'checking') {
    return (
      <Screen ambient="calm" quiet header={header} contentStyle={styles.content}>
        <Reveal index={0} style={styles.intro}>
          <SWText variant="bodyLarge" tone="textSecondary" accessibilityLiveRegion="polite">
            Opening your reset link…
          </SWText>
        </Reveal>
      </Screen>
    );
  }

  if (status !== 'ready') {
    const copy = stopped[status];
    return (
      <Screen ambient="calm" quiet header={header} contentStyle={styles.content}>
        <Reveal index={0} style={styles.intro}>
          <Animated.View entering={stampIn} style={styles.icon}>
            <Link2Off size={24} strokeWidth={1.75} color={colors.danger} />
          </Animated.View>
          <SWText variant="displayHero" accessibilityRole="header">
            {copy.title}
          </SWText>
          <SWText variant="bodyLarge" tone="textSecondary" accessibilityLiveRegion="polite">
            {copy.body}
          </SWText>
        </Reveal>
        <Reveal index={1} style={styles.actions}>
          {status === 'failed' ? <Button label="Try again" onPress={onRetry} /> : null}
          {status === 'expired' || status === 'invalid' ? (
            <Button label="Send a new link" onPress={onRequestNewLink} />
          ) : null}
          <Button
            label="Back to log in"
            variant={status === 'unavailable' ? 'primary' : 'tertiary'}
            onPress={onBackToLogin}
          />
        </Reveal>
      </Screen>
    );
  }

  return (
    <Screen ambient="calm" quiet header={header} contentStyle={styles.content}>
      <Reveal index={0} style={styles.intro}>
        <Animated.View entering={stampIn} style={styles.icon}>
          <KeyRound size={24} strokeWidth={1.75} color={colors.textPrimary} />
        </Animated.View>
        <SWText variant="displayHero" accessibilityRole="header">
          Choose a new password.
        </SWText>
        <SWText variant="bodyLarge" tone="textSecondary">
          Once it’s saved you’re signed in, and the old password stops working.
        </SWText>
      </Reveal>

      <Reveal index={1} style={styles.form}>
        <Field label="New password" helper={`At least ${minimumPasswordLength} characters.`}>
          <PasswordField
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setProblem(null);
            }}
            placeholder="Your new password"
            autoComplete="new-password"
            textContentType="newPassword"
            accessibilityLabel="New password"
          />
        </Field>
        <Field label="Confirm new password">
          <PasswordField
            value={confirmation}
            onChangeText={(value) => {
              setConfirmation(value);
              setProblem(null);
            }}
            onSubmitEditing={save}
            placeholder="The same again"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            accessibilityLabel="Confirm new password"
          />
        </Field>
        {problem ? (
          <SWText variant="bodySmall" tone="danger" accessibilityLiveRegion="assertive">
            {problem}
          </SWText>
        ) : null}
      </Reveal>

      <Reveal index={2} style={styles.actions}>
        <Button
          label={saving ? 'Saving…' : 'Save password'}
          loading={saving}
          disabled={password.length === 0 || confirmation.length === 0}
          onPress={save}
        />
      </Reveal>
    </Screen>
  );
}

const stylesFor = themedStyles((colors) => ({
  content: {
    paddingTop: tokens.spacing[6],
    gap: tokens.spacing[10],
  },
  intro: {
    gap: tokens.spacing[3],
  },
  icon: {
    width: tokens.spacing[12],
    height: tokens.spacing[12],
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
    marginBottom: tokens.spacing[2],
  },
  form: {
    gap: tokens.spacing[3],
  },
  actions: {
    gap: tokens.spacing[3],
  },
}));
