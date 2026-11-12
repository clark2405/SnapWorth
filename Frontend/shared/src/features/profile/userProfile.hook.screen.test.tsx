import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useUserProfile } from './userProfile';

// A stand-in Supabase whose profile row answers when the test says so, per account.
const mockPending = new Map<string, (row: Record<string, string>) => void>();
const mockClient = {
  auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
  from: () => ({
    select: (_columns: string, options?: { head?: boolean }) => {
      if (options?.head) {
        const query = {
          eq: () => query,
          neq: () => query,
          or: () => query,
          then: (resolve: (value: unknown) => void) => resolve({ count: 1, error: null }),
        };
        return query;
      }
      return {
        eq: (_column: string, id: string) => ({
          maybeSingle: () =>
            new Promise((resolve) => {
              mockPending.set(id, (row) => resolve({ data: row }));
            }),
        }),
      };
    },
  }),
};
jest.mock('../../adapters/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => mockClient,
}));

let mockSession: { user: { id: string; email: string } | null; status: 'guest' | 'member' };
jest.mock('../session', () => ({ useSession: () => mockSession }));

const ana = { id: 'ana', email: 'ana@example.com' };
const ben = { id: 'ben', email: 'ben@example.com' };

beforeEach(() => {
  mockPending.clear();
  mockSession = { user: ana, status: 'member' };
});

describe('useUserProfile', () => {
  it('does not let a slower answer for the last account overwrite the new one', async () => {
    const { result, rerender } = renderHook(() => useUserProfile());
    await waitFor(() => expect(mockPending.has('ana')).toBe(true));

    // Ben signs in before Ana's profile has come back.
    mockSession = { user: ben, status: 'member' };
    rerender({});
    await waitFor(() => expect(mockPending.has('ben')).toBe(true));
    expect(result.current.profile.id).toBe('ben');

    await act(async () => {
      mockPending.get('ben')!({ handle: 'ben_handle' });
    });
    await waitFor(() => expect(result.current.profile.handle).toBe('ben_handle'));

    // Ana's late answer arrives now.
    await act(async () => {
      mockPending.get('ana')!({ handle: 'ana_handle' });
    });
    expect(result.current.profile.handle).toBe('ben_handle');
    expect(result.current.profile.id).toBe('ben');
  });

  it('shows the new account’s own details at once, not the last account’s', async () => {
    const { result, rerender } = renderHook(() => useUserProfile());
    await waitFor(() => expect(mockPending.has('ana')).toBe(true));
    await act(async () => {
      mockPending.get('ana')!({ handle: 'ana_handle' });
    });
    await waitFor(() => expect(result.current.profile.handle).toBe('ana_handle'));

    mockSession = { user: ben, status: 'member' };
    rerender({});
    expect(result.current.profile.id).toBe('ben');
    expect(result.current.profile.handle).not.toBe('ana_handle');
  });

  it('sets no state once the screen has gone', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { unmount } = renderHook(() => useUserProfile());
    await waitFor(() => expect(mockPending.has('ana')).toBe(true));
    unmount();
    await act(async () => {
      mockPending.get('ana')!({ handle: 'late' });
    });
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
