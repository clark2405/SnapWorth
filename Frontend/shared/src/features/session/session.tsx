import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Sheet, SWText } from '../../components';
import { tokens } from '../../design';

/**
 * Anything someone does rather than looks at. Browsing the feed, the market and seller pages is
 * open to everyone; each of these asks for an account at the moment it is tried, not at launch.
 */
export type AccountIntent =
  | 'vote'
  | 'comment'
  | 'report'
  | 'save'
  | 'offer'
  | 'message'
  | 'alert'
  | 'snap'
  | 'sell'
  | 'chats'
  | 'history'
  | 'profile';

/** Why an account is needed, in the words of what the person just tried to do. */
export const accountIntentCopy: Record<AccountIntent, { title: string; body: string }> = {
  vote: {
    title: 'Vote on the price',
    body: 'Votes come from real accounts, so the community verdict stays fair.',
  },
  comment: {
    title: 'Join the discussion',
    body: 'Create a free account to share your take on the price.',
  },
  report: {
    title: 'Report with an account',
    body: 'Reports come from accounts so moderators can follow up.',
  },
  save: {
    title: 'Save listings',
    body: 'Create a free account to keep listings you like in one place.',
  },
  offer: {
    title: 'Make an offer',
    body: 'Offers go to the seller from your account, so they know who is buying.',
  },
  message: {
    title: 'Message the seller',
    body: 'Create a free account to chat with sellers and arrange pickup.',
  },
  alert: {
    title: 'Get price alerts',
    body: 'Create a free account and we will tell you when the price drops.',
  },
  snap: {
    title: 'Snap your own items',
    body: 'Create a free account to photograph an item and get its fair range.',
  },
  sell: {
    title: 'Sell on SnapWorth',
    body: 'Create a free account to list items and talk to buyers.',
  },
  chats: {
    title: 'Your chats live here',
    body: 'Create a free account to message sellers and buyers.',
  },
  history: {
    title: 'Keep track of what you value',
    body: 'Create a free account and every item you snap is saved here.',
  },
  profile: {
    title: 'Make it yours',
    body: 'Create a free account to vote, save listings and value your own things.',
  },
};

/** Where the account screens are; the app shell owns navigation, so it supplies them. */
export interface SessionProviderProps {
  readonly onCreateAccount: () => void;
  readonly onSignIn: () => void;
  readonly children: ReactNode;
}

interface SessionContextValue {
  readonly status: 'guest' | 'member';
  /** Marks the viewer signed in, then finishes whatever they were trying to do. */
  readonly startSession: () => void;
  readonly endSession: () => void;
  readonly requireAccount: (intent: AccountIntent, action?: () => void) => void;
  readonly createAccount: () => void;
  readonly signIn: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Who is using the app. Everyone starts as a guest who can look around; an account is asked for
 * only when they act. There is no auth service yet, so signing in or up just marks the session.
 */
export function SessionProvider({ onCreateAccount, onSignIn, children }: SessionProviderProps) {
  const [status, setStatus] = useState<'guest' | 'member'>('guest');
  const [asking, setAsking] = useState<AccountIntent | null>(null);
  // The action that prompted the sheet, kept so it can finish once the person has an account.
  const pending = useRef<(() => void) | null>(null);
  const resume = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (status !== 'member' || !resume.current) return;
    const action = resume.current;
    resume.current = null;
    // Let the account screen close first, so the action lands on the screen it came from.
    const timer = setTimeout(action, 450);
    return () => clearTimeout(timer);
  }, [status]);

  const requireAccount = useCallback(
    (intent: AccountIntent, action?: () => void) => {
      if (status === 'member') {
        action?.();
        return;
      }
      pending.current = action ?? null;
      setAsking(intent);
    },
    [status],
  );

  const leaveSheet = useCallback((next?: () => void) => {
    resume.current = pending.current;
    pending.current = null;
    setAsking(null);
    next?.();
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      startSession: () => setStatus('member'),
      endSession: () => {
        resume.current = null;
        setStatus('guest');
      },
      requireAccount,
      createAccount: onCreateAccount,
      signIn: onSignIn,
    }),
    [onCreateAccount, onSignIn, requireAccount, status],
  );

  const copy = asking ? accountIntentCopy[asking] : null;

  return (
    <SessionContext.Provider value={value}>
      {children}
      <Sheet
        visible={asking !== null}
        onClose={() => {
          pending.current = null;
          setAsking(null);
        }}
        title={copy?.title}
      >
        <View style={styles.sheet}>
          <SWText variant="bodyMedium" tone="textSecondary">
            {copy?.body}
          </SWText>
          <View style={styles.actions}>
            <Button label="Create free account" onPress={() => leaveSheet(onCreateAccount)} />
            <Button
              label="I have an account"
              variant="secondary"
              onPress={() => leaveSheet(onSignIn)}
            />
            <Button
              label="Keep looking around"
              variant="tertiary"
              onPress={() => {
                pending.current = null;
                setAsking(null);
              }}
            />
          </View>
        </View>
      </Sheet>
    </SessionContext.Provider>
  );
}

function useSessionContext(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('Session hooks need a SessionProvider above them.');
  return context;
}

export function useSession() {
  const { status, startSession, endSession, createAccount, signIn } = useSessionContext();
  return { status, isGuest: status === 'guest', startSession, endSession, createAccount, signIn };
}

/**
 * Runs `action` for someone signed in; for a guest, explains why an account is needed and
 * finishes the action after they sign in or sign up.
 */
export function useAccountGate(): SessionContextValue['requireAccount'] {
  return useSessionContext().requireAccount;
}

const styles = StyleSheet.create({
  sheet: {
    gap: tokens.spacing[5],
  },
  actions: {
    gap: tokens.spacing[2],
  },
});
