import { Camera, Clock, MessageSquare, UserRound, type LucideIcon } from 'lucide-react-native';

import { Button, EmptyState, LargeTitle, NavHeader, Reveal, Screen } from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import { accountIntentCopy, useSession, type AccountIntent } from './session';

type GatedScreen = Extract<AccountIntent, 'snap' | 'chats' | 'history' | 'profile'>;

const icons: Record<GatedScreen, LucideIcon> = {
  snap: Camera,
  chats: MessageSquare,
  history: Clock,
  profile: UserRound,
};

export interface AccountGateViewProps {
  /** The screen's own name, so a guest still knows where they are. */
  readonly title: string;
  readonly intent: GatedScreen;
  /** A pushed screen has a way back; a tab does not. */
  readonly onBack?: () => void;
}

/**
 * What a guest sees on a screen that only makes sense with an account: the screen keeps its
 * name, says plainly what it is for, and offers a way in without forcing one.
 */
export function AccountGateView({ title, intent, onBack }: AccountGateViewProps) {
  const styles = useThemedStyles(stylesFor);
  const { createAccount, signIn } = useSession();
  const copy = accountIntentCopy[intent];

  return (
    <Screen
      clearTabBar={!onBack}
      header={onBack ? <NavHeader title={title} onBack={onBack} /> : undefined}
    >
      {onBack ? null : <LargeTitle brand title={title} />}
      <EmptyState icon={icons[intent]} title={copy.title} body={copy.body} />
      <Reveal index={1} style={styles.actions}>
        <Button label="Create free account" onPress={createAccount} />
        <Button label="I have an account" variant="secondary" onPress={signIn} />
      </Reveal>
    </Screen>
  );
}

const stylesFor = themedStyles(() => ({
  actions: {
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.spacing[4],
  },
}));
