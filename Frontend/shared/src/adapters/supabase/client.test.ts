import { authStorageForRuntime, createSupabaseClient } from './client';

const unusedDeviceStorage = {
  getItem: () => {
    throw new Error('device storage must not run without a window');
  },
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve(),
};

describe('Supabase client on the server', () => {
  it('does not use device storage while window is missing', async () => {
    expect(typeof window).toBe('undefined');
    const storage = authStorageForRuntime(unusedDeviceStorage);
    await expect(storage.getItem('sb-session')).resolves.toBeNull();
    expect(() =>
      createSupabaseClient(
        { url: 'https://example.supabase.co', anonKey: 'anon' },
        unusedDeviceStorage,
      ),
    ).not.toThrow();
  });
});
