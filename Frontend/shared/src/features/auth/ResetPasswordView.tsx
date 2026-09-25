import { MailCheck } from 'lucide-react-native';
import { useState } from 'react';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Button, Field, NavHeader, Reveal, Screen, SWText, TextField } from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';

export interface ResetPasswordViewProps {
  readonly onBack?: () => void;
  /** Sends the reset link. Resolve `false` to show the failure state. */
  readonly onSendLink?: (email: string) => Promise<boolean> | boolean;
  readonly onBackToLogin?: () => void;
}

type Status = 'idle' | 'sending' | 'sent' | 'error';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ResetPasswordView({ onBack, onSendLink, onBackToLogin }: ResetPasswordViewProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const valid = emailPattern.test(email.trim());

  const send = async () => {
    if (!valid || status === 'sending') return;
    setStatus('sending');
    const ok = onSendLink ? await onSendLink(email.trim()) : true;
    setStatus(ok ? 'sent' : 'error');
  };

  if (status === 'sent') {
    return (
      <Screen
        ambient="aurora"
        header={<NavHeader title="" onBack={onBack} />}
        contentStyle={styles.content}
      >
        <Reveal index={0} style={styles.intro}>
          <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.icon}>
            <MailCheck size={24} strokeWidth={1.75} color={colors.success} />
          </Animated.View>
          <SWText variant="displayHero" accessibilityRole="header">
            Check your inbox.
          </SWText>
          <SWText variant="bodyLarge" tone="textSecondary" accessibilityLiveRegion="polite">
            {`If ${email.trim()} has an account, a reset link is on its way. It expires in one hour.`}
          </SWText>
        </Reveal>
        <Reveal index={1} style={styles.actions}>
          <Button label="Back to log in" onPress={onBackToLogin} />
          <Button
            label="Use a different email"
            variant="tertiary"
            onPress={() => setStatus('idle')}
          />
        </Reveal>
      </Screen>
    );
  }

  return (
    <Screen
      ambient="aurora"
      header={<NavHeader title="" onBack={onBack} />}
      contentStyle={styles.content}
    >
      <Reveal index={0} style={styles.intro}>
        <SWText variant="displayHero" accessibilityRole="header">
          Reset your password.
        </SWText>
        <SWText variant="bodyLarge" tone="textSecondary">
          Enter the email you signed up with and we will send you a link to choose a new one.
        </SWText>
      </Reveal>

      <Reveal index={1} style={styles.form}>
        <Field
          label="Email"
          helper={status === 'error' ? undefined : 'We never say whether an email has an account.'}
        >
          <TextField
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (status === 'error') setStatus('idle');
            }}
            onSubmitEditing={send}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            accessibilityLabel="Email address"
          />
        </Field>
        {status === 'error' ? (
          <SWText variant="bodySmall" tone="danger" accessibilityLiveRegion="assertive">
            The link could not be sent. Check your connection and try again.
          </SWText>
        ) : null}
      </Reveal>

      <Reveal index={2} style={styles.actions}>
        <Button
          label={status === 'sending' ? 'Sending…' : 'Send reset link'}
          loading={status === 'sending'}
          disabled={!valid}
          onPress={send}
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
