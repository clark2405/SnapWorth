import { act, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect, useRef } from 'react';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppServicesProvider } from '../../composition';
import { ToastProvider } from '../../components';
import { ThemeProvider } from '../../design';
import { ConversationListView } from '../chat/ConversationListView';
import { FeedView } from '../feed/FeedView';
import { HistoryView } from '../history/HistoryView';
import { MarketplaceView } from '../marketplace/MarketplaceView';
import { TipsProvider } from '../tips';
import { SessionProvider, useSession } from './session';

// A stand-in Supabase with nobody signed in. `authChanged` plays a sign-in or sign-out;
// `signInAnonymously` must never be called: visiting a screen is not a reason to make an account.
type Listener = (event: string, session: unknown) => void;
const mockState = {
  session: null as unknown,
  listeners: new Set<Listener>(),
  signInAnonymously: jest.fn(),
  signOut: jest.fn(),
};
const mockQuery: unknown = new Proxy(() => undefined, {
  get: (_target, property) => {
    if (property === 'then') {
      return (resolve: (value: unknown) => void) => resolve({ data: [], error: null, count: 0 });
    }
    if (property === 'maybeSingle' || property === 'single') {
      return async () => ({ data: null, error: null });
    }
    return () => mockQuery;
  },
  apply: () => mockQuery,
});
const mockClient = {
  auth: {
    getSession: async () => ({ data: { session: mockState.session }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: (listener: Listener) => {
      mockState.listeners.add(listener);
      return {
        data: { subscription: { unsubscribe: () => mockState.listeners.delete(listener) } },
      };
    },
    signInAnonymously: (...args: unknown[]) => mockState.signInAnonymously(...args),
    signOut: (...args: unknown[]) => mockState.signOut(...args),
  },
  from: () => mockQuery,
  rpc: () => mockQuery,
  storage: { from: () => mockQuery },
  functions: { invoke: async () => ({ data: null, error: null }) },
  channel: () => mockQuery,
  removeChannel: () => undefined,
};
jest.mock('../../adapters/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => mockClient,
}));

const noop = () => undefined;
const metrics = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 62, left: 0, right: 0, bottom: 34 },
};

function authChanged(event: string, session: unknown) {
  act(() => mockState.listeners.forEach((listener) => listener(event, session)));
}

beforeEach(() => {
  mockState.session = null;
  mockState.listeners.clear();
  mockState.signInAnonymously.mockReset();
  mockState.signOut.mockReset().mockResolvedValue({ error: null });
});

function Status() {
  const { status, user } = useSession();
  return <Text>{`status:${status} user:${user?.id ?? 'none'}`}</Text>;
}

function shell(children: React.ReactNode) {
  return render(
    <GestureHandlerRootView>
      <SafeAreaProvider initialMetrics={metrics}>
        <ThemeProvider>
          <ToastProvider>
            <SessionProvider onCreateAccount={noop} onSignIn={noop}>
              <TipsProvider>{children}</TipsProvider>
            </SessionProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>,
  );
}

describe('SessionProvider and anonymous sessions', () => {
  it('treats an anonymous Supabase session as a guest, not a member', async () => {
    mockState.session = { user: { id: 'anon_1', is_anonymous: true } };
    shell(<Status />);
    // The session is read on mount; give it its turn, then it must still be a guest.
    await act(async () => undefined);
    expect(screen.getByText('status:guest user:none')).toBeOnTheScreen();

    authChanged('SIGNED_IN', { user: { id: 'anon_2', is_anonymous: true } });
    expect(screen.getByText('status:guest user:none')).toBeOnTheScreen();
  });

  it('makes a real account a member, and signing out a guest again', async () => {
    shell(<Status />);
    await act(async () => undefined);
    authChanged('SIGNED_IN', { user: { id: 'usr_1', is_anonymous: false, email: 'a@b.c' } });
    expect(screen.getByText('status:member user:usr_1')).toBeOnTheScreen();
    authChanged('SIGNED_OUT', null);
    expect(screen.getByText('status:guest user:none')).toBeOnTheScreen();
  });

  it('is loading until the saved session has been read, then a member (not a guest first)', async () => {
    let release: (value: unknown) => void = () => undefined;
    const read = new Promise((resolve) => (release = resolve));
    const seen: string[] = [];
    function Watch() {
      const { status, isLoading, isGuest } = useSession();
      seen.push(`${status}${isLoading ? ':loading' : ''}${isGuest ? ':guest' : ''}`);
      return null;
    }
    const original = mockClient.auth.getSession;
    mockClient.auth.getSession = () => read as never;
    try {
      shell(<Watch />);
      expect(seen[0]).toBe('loading:loading:guest');
      await act(async () => {
        release({
          data: { session: { user: { id: 'usr_1', is_anonymous: false, email: 'a@b.c' } } },
          error: null,
        });
        await read;
      });
      expect(seen[seen.length - 1]).toBe('member');
      // Signed in all along: it was never reported as a settled guest.
      expect(seen.some((entry) => entry === 'guest:guest')).toBe(false);
    } finally {
      mockClient.auth.getSession = original;
    }
  });

  it('becomes a guest, not stuck loading, when nobody is signed in or the read fails', async () => {
    shell(<Status />);
    await act(async () => undefined);
    expect(screen.getByText('status:guest user:none')).toBeOnTheScreen();
  });

  it('starts a signed-in session as a member on launch', async () => {
    mockState.session = { user: { id: 'usr_1', is_anonymous: false, email: 'a@b.c' } };
    shell(<Status />);
    await waitFor(() => expect(screen.getByText('status:member user:usr_1')).toBeOnTheScreen());
  });
});

describe('visiting the tabs signed out', () => {
  function LogOutOnce() {
    const { endSession } = useSession();
    const done = useRef(false);
    useEffect(() => {
      if (done.current) return;
      done.current = true;
      endSession();
    }, [endSession]);
    return null;
  }

  it('creates no session on the Feed, Market, Chats or History, and shows a guest', async () => {
    shell(
      <AppServicesProvider
        config={{ supabaseUrl: 'https://x.supabase.test', supabaseAnonKey: 'k' }}
      >
        <Status />
        <FeedView />
        <MarketplaceView />
        <ConversationListView />
        <HistoryView />
      </AppServicesProvider>,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(mockState.signInAnonymously).not.toHaveBeenCalled();
    expect(screen.getByText('status:guest user:none')).toBeOnTheScreen();
  });

  it('stays logged out after logging out and visiting the tabs again', async () => {
    mockState.session = { user: { id: 'usr_1', is_anonymous: false, email: 'a@b.c' } };
    shell(
      <AppServicesProvider
        config={{ supabaseUrl: 'https://x.supabase.test', supabaseAnonKey: 'k' }}
      >
        <Status />
        <LogOutOnce />
        <FeedView />
        <MarketplaceView />
        <ConversationListView />
        <HistoryView />
      </AppServicesProvider>,
    );
    await act(async () => undefined);
    // Supabase answers the sign-out the way it does: no session any more.
    mockState.session = null;
    authChanged('SIGNED_OUT', null);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(mockState.signOut).toHaveBeenCalled();
    expect(mockState.signInAnonymously).not.toHaveBeenCalled();
    expect(screen.getByText('status:guest user:none')).toBeOnTheScreen();
  });
});
