import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchIsAdmin } from './admin-role';

const answering = (result: unknown) =>
  ({ rpc: jest.fn(() => Promise.resolve(result)) }) as unknown as SupabaseClient;

describe('fetchIsAdmin', () => {
  it('asks the database through is_admin', async () => {
    const client = answering({ data: true, error: null });

    await expect(fetchIsAdmin(client)).resolves.toBe(true);
    expect(client.rpc).toHaveBeenCalledWith('is_admin');
  });

  it('is no when the database says no', async () => {
    await expect(fetchIsAdmin(answering({ data: false, error: null }))).resolves.toBe(false);
  });

  it('is no for anything but a clear yes', async () => {
    await expect(fetchIsAdmin(answering({ data: null, error: null }))).resolves.toBe(false);
    await expect(fetchIsAdmin(answering({ data: 'true', error: null }))).resolves.toBe(false);
    await expect(
      fetchIsAdmin(answering({ data: true, error: { code: '42501', message: 'denied' } })),
    ).resolves.toBe(false);
  });

  it('is no when the call itself fails', async () => {
    const client = { rpc: () => Promise.reject(new TypeError('Failed to fetch')) };

    await expect(fetchIsAdmin(client as unknown as SupabaseClient)).resolves.toBe(false);
  });
});
