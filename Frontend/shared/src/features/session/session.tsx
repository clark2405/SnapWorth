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

import { getSupabase, isSupabaseConfigured } from '../../adapters/supabaseClient';
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
  | 'profile'
  | 'worthy';

/** Why an account is needed, in the words of what the person just tried to do. */
export const accountIntentCopy: Record<AccountIntent, { title: string; body: string }> = {
  worthy: {
    title: 'Ask Worthy',
    body: 'Create a free account and Worthy helps with your own snaps, listings and chats.',
  },
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
    title: 'Haggle here.',
    body: 'Make a free account to message sellers, make offers and arrange pickup.',
  },
  history: {
    title: 'Every snap gets a tag.',
    body: 'Make a free account and everything you price is kept here, worth and all.',
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

/**
 * The signed-in person: a Supabase user, or one made on this device when no Supabase project is
 * set up. Only the fields the app reads are listed, so both fit.
 */
export interface SessionUser {
  readonly id: string;
  readonly email?: string;
  readonly created_at?: string;
  readonly user_metadata?: Record<string, unknown>;
  readonly app_metadata?: Record<string, unknown>;
}

interface SessionContextValue {
  readonly status: 'guest' | 'member';
  readonly user: SessionUser | null;
  readonly startSession: (userData?: SessionUser | null) => void;
  readonly endSession: () => void;
  readonly setUser: (userData: SessionUser | null) => void;
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
  const [user, setUser] = useState<SessionUser | null>(null);
  const [asking, setAsking] = useState<AccountIntent | null>(null);

  // The action that prompted the sheet, kept so it can finish once the person has an account.
  const pending = useRef<(() => void) | null>(null);
  const resume = useRef<(() => void) | null>(null);

  // Sync session with Supabase on mount
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    try {
      const supabase = getSupabase();
      void supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!active) return;
          if (data?.session?.user) {
            setStatus('member');
            setUser(data.session.user);
          }
        })
        .catch(() => {});

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        if (session?.user) {
          setStatus('member');
          setUser(session.user);
        } else {
          setStatus('guest');
          setUser(null);
        }
      });

      return () => {
        active = false;
        subscription?.unsubscribe();
      };
    } catch {
      // Supabase is not configured or reachable, so there is nothing to clean up.
      return undefined;
    }
  }, []);

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
      user,
      startSession: (userData?: SessionUser | null) => {
        setStatus('member');
        if (userData) {
          setUser(userData);
        } else if (isSupabaseConfigured()) {
          try {
            void getSupabase()
              .auth.getUser()
              .then(({ data }) => {
                if (data?.user) setUser(data.user);
              })
              .catch(() => {});
          } catch {
            // Supabase is not reachable; the session goes on without its details.
          }
        }
      },
      endSession: () => {
        resume.current = null;
        setStatus('guest');
        setUser(null);
        if (isSupabaseConfigured()) {
          try {
            void getSupabase()
              .auth.signOut()
              .catch(() => {});
          } catch {
            // Supabase is not reachable; the session here has ended either way.
          }
        }
      },
      setUser: (userData: SessionUser | null) => setUser(userData),
      requireAccount,
      createAccount: onCreateAccount,
      signIn: onSignIn,
    }),
    [onCreateAccount, onSignIn, requireAccount, status, user],
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
  const { status, user, startSession, endSession, setUser, createAccount, signIn } =
    useSessionContext();
  return {
    status,
    user,
    isGuest: status === 'guest',
    startSession,
    endSession,
    setUser,
    createAccount,
    signIn,
  };
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
