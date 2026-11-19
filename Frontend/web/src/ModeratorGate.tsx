import { ShieldAlert, WifiOff } from 'lucide-react-native';
import { View } from 'react-native';

import { Button, EmptyState, Screen } from '@snapworth/shared/components';
import { tokens } from '@snapworth/shared/design';

/**
 * What the website shows someone signed in who can't use it: the website is the moderators'
 * console, so anyone else is pointed at the phone app. `failed` is a check that got no answer
 * (offline, a server error), which isn't a no: they can try again.
 */
export function ModeratorGate({
  reason,
  onRetry,
  onSignOut,
}: {
  readonly reason: 'not-admin' | 'failed';
  readonly onRetry: () => void;
  readonly onSignOut: () => void;
}) {
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: tokens.spacing[4] }}>
        {reason === 'failed' ? (
          <EmptyState
            icon={WifiOff}
            tone="error"
            title="Couldn’t check your account"
            body="SnapWorth couldn’t reach the server to see whether you’re a moderator. Check your connection and try again."
            actionLabel="Try again"
            onAction={onRetry}
          />
        ) : (
          <EmptyState
            icon={ShieldAlert}
            title="This website is for moderators"
            body="SnapWorth’s website is where moderators review posts, comments and reports. To snap, buy and sell, use the SnapWorth app on your phone."
          />
        )}
        <View style={{ alignSelf: 'center' }}>
          <Button label="Sign out" variant="secondary" onPress={onSignOut} />
        </View>
      </View>
    </Screen>
  );
}
