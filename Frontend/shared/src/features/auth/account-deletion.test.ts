import { confirmsDeletion, deleteAccount, forgetAccountOnDevice } from './account-deletion';

const ana = '8b0c6a52-5a3e-4d7e-9b7a-3f1f6c0d2e11';

// A stand-in for the Supabase client: each test says what it answers.
const mockClient = {
  auth: { getSession: jest.fn(), signOut: jest.fn() },
  functions: { invoke: jest.fn() },
};
let mockConfigured = true;

jest.mock('../../adapters/supabaseClient', () => ({
  isSupabaseConfigured: () => mockConfigured,
  getSupabase: () => mockClient,
}));
// The device store comes in as a parameter; the default one is never touched here.
jest.mock('@react-native-async-storage/async-storage', () => ({}));

/** A device store holding these keys, recording what it was asked to remove. */
function deviceStore(keys: string[]) {
  const store = {
    keys: [...keys],
    getAllKeys: jest.fn(async () => store.keys),
    multiRemove: jest.fn(async (gone: readonly string[]) => {
      store.keys = store.keys.filter((key) => !gone.includes(key));
    }),
  };
  return store;
}

const deviceKeys = [
  `@snapworth/scan_history:${ana}`,
  '@snapworth/scan_history:someone-else',
  'snapworth.appearance',
  'snapworth.guess-the-worth.v1',
];

beforeEach(() => {
  mockConfigured = true;
  mockClient.auth.getSession.mockReset().mockResolvedValue({
    data: { session: { user: { id: ana } } },
  });
  mockClient.auth.signOut.mockReset().mockResolvedValue({ error: null });
  mockClient.functions.invoke.mockReset().mockResolvedValue({
    data: { deleted: true },
    error: null,
  });
});

describe('confirmsDeletion', () => {
  it('takes the word in any case, with spaces around it', () => {
    expect(confirmsDeletion('DELETE')).toBe(true);
    expect(confirmsDeletion(' delete ')).toBe(true);
    expect(confirmsDeletion('delet')).toBe(false);
    expect(confirmsDeletion('yes')).toBe(false);
  });
});

describe('deleteAccount', () => {
  it('asks the server to delete the account, then forgets it on this device', async () => {
    const store = deviceStore(deviceKeys);

    await expect(deleteAccount('delete', ana, store)).resolves.toEqual({ kind: 'deleted' });

    expect(mockClient.functions.invoke).toHaveBeenCalledWith('delete-account', {
      body: { confirm: 'DELETE' },
    });
    expect(mockClient.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(store.keys).toEqual([
      '@snapworth/scan_history:someone-else',
      'snapworth.appearance',
      'snapworth.guess-the-worth.v1',
    ]);
  });

  it('does nothing until the word is typed', async () => {
    const store = deviceStore(deviceKeys);

    await expect(deleteAccount('yes please', ana, store)).resolves.toEqual({
      kind: 'failed',
      message: 'Type DELETE to confirm.',
    });
    expect(mockClient.functions.invoke).not.toHaveBeenCalled();
    expect(store.multiRemove).not.toHaveBeenCalled();
  });

  it('keeps everything, here too, when the server keeps the account', async () => {
    const store = deviceStore(deviceKeys);
    mockClient.functions.invoke.mockResolvedValue({
      data: null,
      error: { context: Response.json({ code: 'files_not_removed' }, { status: 503 }) },
    });

    const outcome = await deleteAccount('DELETE', ana, store);

    expect(outcome).toEqual({
      kind: 'failed',
      message: 'Your account couldn’t be deleted. Check your connection and try again.',
    });
    expect(mockClient.auth.signOut).not.toHaveBeenCalled();
    expect(store.keys).toEqual(deviceKeys);
  });

  it('explains the server’s refusals it can name', async () => {
    mockClient.functions.invoke.mockResolvedValue({
      data: null,
      error: { context: Response.json({ code: 'rate_limited' }, { status: 429 }) },
    });
    await expect(deleteAccount('DELETE', ana, deviceStore([]))).resolves.toEqual({
      kind: 'failed',
      message: 'Too many tries. Wait a few minutes, then try again.',
    });

    mockClient.auth.getSession.mockResolvedValue({ data: { session: null } });
    await expect(deleteAccount('DELETE', ana, deviceStore([]))).resolves.toMatchObject({
      kind: 'failed',
      message: expect.stringMatching(/Log in again/),
    });
  });

  it('fails plainly without a connection', async () => {
    mockClient.functions.invoke.mockRejectedValue(new TypeError('Network request failed'));
    await expect(deleteAccount('DELETE', ana, deviceStore([]))).resolves.toMatchObject({
      kind: 'failed',
    });
  });

  it('without a server, forgets this device’s account and its scans', async () => {
    mockConfigured = false;
    const store = deviceStore(['@snapworth/scan_history:device', 'snapworth.appearance']);

    await expect(deleteAccount('DELETE', 'local_user', store)).resolves.toEqual({
      kind: 'deleted',
    });
    expect(mockClient.functions.invoke).not.toHaveBeenCalled();
    expect(store.keys).toEqual(['snapworth.appearance']);
  });
});

describe('forgetAccountOnDevice', () => {
  it('never throws, even when the store can’t be read', async () => {
    const broken = {
      getAllKeys: jest.fn().mockRejectedValue(new Error('locked')),
      multiRemove: jest.fn(),
    };
    await expect(forgetAccountOnDevice(broken, [ana])).resolves.toBeUndefined();
    expect(broken.multiRemove).not.toHaveBeenCalled();
  });
});
