import { finishOAuthRedirect, performAppleAuth, startWebGoogleSignIn } from './authApi';

// A stand-in for the Supabase auth client: each test says what it answers.
const mockAuth = {
  signInWithOAuth: jest.fn(),
  setSession: jest.fn(),
  exchangeCodeForSession: jest.fn(),
  signInWithIdToken: jest.fn(),
  updateUser: jest.fn(),
};

jest.mock('../../adapters/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({ auth: mockAuth }),
}));

const user = { id: 'u1', email: 'ana@example.com', user_metadata: { full_name: 'Ana Cruz' } };

beforeEach(() => {
  for (const fn of Object.values(mockAuth)) fn.mockReset();
});

describe('startWebGoogleSignIn', () => {
  it('leaves for Google, asking to come back to the callback page', async () => {
    mockAuth.signInWithOAuth.mockResolvedValue({
      data: {
        provider: 'google',
        url: 'https://project.supabase.co/auth/v1/authorize?provider=google',
      },
      error: null,
    });
    const open = jest.fn();

    await expect(
      startWebGoogleSignIn('https://snapworth.app/auth/callback', open),
    ).resolves.toBeNull();

    expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://snapworth.app/auth/callback', skipBrowserRedirect: true },
    });
    expect(open).toHaveBeenCalledWith(
      'https://project.supabase.co/auth/v1/authorize?provider=google',
    );
  });

  it('stays on the page with the reason when Google can’t be started', async () => {
    const open = jest.fn();
    mockAuth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: null },
      error: { message: 'Unsupported provider: provider is not enabled' },
    });
    await expect(startWebGoogleSignIn('x', open)).resolves.toBe(
      'Unsupported provider: provider is not enabled',
    );

    mockAuth.signInWithOAuth.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(startWebGoogleSignIn('x', open)).resolves.toBe('Failed to fetch');
    expect(open).not.toHaveBeenCalled();
  });
});

describe('finishOAuthRedirect', () => {
  it('signs in with the session Google’s redirect carries', async () => {
    mockAuth.setSession.mockResolvedValue({ data: { session: {}, user }, error: null });

    await expect(
      finishOAuthRedirect(
        'https://snapworth.app/auth/callback#access_token=tok&refresh_token=ref&provider_token=g',
      ),
    ).resolves.toEqual({ kind: 'signed-in', user });
    expect(mockAuth.setSession).toHaveBeenCalledWith({
      access_token: 'tok',
      refresh_token: 'ref',
    });
  });

  it('exchanges a PKCE code', async () => {
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: { session: {}, user }, error: null });

    await expect(
      finishOAuthRedirect('https://snapworth.app/auth/callback?code=abc'),
    ).resolves.toEqual({ kind: 'signed-in', user });
  });

  it('treats turning Google down as cancelled, not failed', async () => {
    await expect(
      finishOAuthRedirect(
        'https://snapworth.app/auth/callback?error=access_denied&error_description=The+user+denied+access',
      ),
    ).resolves.toEqual({ kind: 'cancelled' });
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });

  it('passes on any other error Supabase sent back', async () => {
    await expect(
      finishOAuthRedirect(
        'https://snapworth.app/auth/callback#error=server_error&error_description=Unable+to+exchange+external+code',
      ),
    ).resolves.toEqual({ kind: 'failed', message: 'Unable to exchange external code' });
  });

  it('fails plainly when the session is refused, or the page was opened by hand', async () => {
    mockAuth.setSession.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid Refresh Token' },
    });
    await expect(
      finishOAuthRedirect('https://snapworth.app/auth/callback#access_token=a&refresh_token=b'),
    ).resolves.toEqual({ kind: 'failed', message: 'Invalid Refresh Token' });

    await expect(finishOAuthRedirect('https://snapworth.app/auth/callback')).resolves.toMatchObject(
      { kind: 'failed' },
    );
    expect(mockAuth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe('performAppleAuth', () => {
  const credential = { idToken: 'apple-id-token', rawNonce: 'raw-nonce' };

  it('signs in with Apple’s identity token and the nonce before hashing', async () => {
    mockAuth.signInWithIdToken.mockResolvedValue({ data: { session: {}, user }, error: null });

    const result = await performAppleAuth(credential);

    expect(mockAuth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'apple-id-token',
      nonce: 'raw-nonce',
    });
    expect(result.data.user).toBe(user);
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });

  it('keeps the name Apple sends only on a first sign-in', async () => {
    const unnamed = { id: 'u2', user_metadata: {} };
    const named = { ...unnamed, user_metadata: { full_name: 'Ana Cruz' } };
    mockAuth.signInWithIdToken.mockResolvedValue({
      data: { session: {}, user: unnamed },
      error: null,
    });
    mockAuth.updateUser.mockResolvedValue({ data: { user: named }, error: null });

    const result = await performAppleAuth({ ...credential, fullName: 'Ana Cruz' });

    expect(mockAuth.updateUser).toHaveBeenCalledWith({ data: { full_name: 'Ana Cruz' } });
    expect(result.data.user).toBe(named);
  });

  it('passes a refused token on as it is', async () => {
    const refusal = { message: 'Nonces mismatch', status: 400 };
    mockAuth.signInWithIdToken.mockResolvedValue({
      data: { session: null, user: null },
      error: refusal,
    });

    const result = await performAppleAuth({ ...credential, fullName: 'Ana Cruz' });

    expect(result.error).toBe(refusal);
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });
});
