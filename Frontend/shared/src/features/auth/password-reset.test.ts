import { openRecoveryLink, requestPasswordReset, saveNewPassword } from './password-reset';

// A stand-in for the Supabase auth client: each test says what it answers.
const mockAuth = {
  resetPasswordForEmail: jest.fn(),
  setSession: jest.fn(),
  exchangeCodeForSession: jest.fn(),
  getSession: jest.fn(),
  updateUser: jest.fn(),
};
let mockConfigured = true;

jest.mock('../../adapters/supabaseClient', () => ({
  isSupabaseConfigured: () => mockConfigured,
  getSupabase: () => ({ auth: mockAuth }),
}));

beforeEach(() => {
  mockConfigured = true;
  for (const fn of Object.values(mockAuth)) fn.mockReset();
});

const apiError = (status: number, code: string, message = code) => ({ status, code, message });

describe('requestPasswordReset', () => {
  it('asks Supabase to email a link back to the given address', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    await expect(
      requestPasswordReset('ana@example.com', 'https://snapworth.app/new-password'),
    ).resolves.toBe('sent');
    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith('ana@example.com', {
      redirectTo: 'https://snapworth.app/new-password',
    });
  });

  it('reports a rate limit as sent, since only an address with an account reaches one', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: apiError(429, 'over_email_send_rate_limit'),
    });

    await expect(requestPasswordReset('ana@example.com', 'x')).resolves.toBe('sent');
  });

  it('says the request failed when it never got through', async () => {
    mockAuth.resetPasswordForEmail.mockRejectedValue(new TypeError('Network request failed'));
    await expect(requestPasswordReset('ana@example.com', 'x')).resolves.toBe('failed');

    mockAuth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: apiError(500, 'unexpected_failure'),
    });
    await expect(requestPasswordReset('ana@example.com', 'x')).resolves.toBe('failed');
  });

  it('is unavailable without a Supabase project, and sends nothing', async () => {
    mockConfigured = false;
    await expect(requestPasswordReset('ana@example.com', 'x')).resolves.toBe('unavailable');
    expect(mockAuth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe('openRecoveryLink', () => {
  const tokens =
    'https://snapworth.app/new-password#access_token=tok&refresh_token=ref&type=recovery';

  it('signs in with the session the link carries', async () => {
    mockAuth.setSession.mockResolvedValue({ data: { session: {}, user: {} }, error: null });

    await expect(openRecoveryLink(tokens)).resolves.toBe('ready');
    expect(mockAuth.setSession).toHaveBeenCalledWith({
      access_token: 'tok',
      refresh_token: 'ref',
    });
  });

  it('exchanges a code from a link made with PKCE', async () => {
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });

    await expect(openRecoveryLink('snapworth://new-password?code=abc')).resolves.toBe('ready');
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
  });

  it('knows an expired or used link from the error Supabase puts on it', async () => {
    await expect(
      openRecoveryLink(
        'https://snapworth.app/new-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).resolves.toBe('expired');
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });

  it('calls any other error on the link invalid', async () => {
    await expect(
      openRecoveryLink('snapworth://new-password?error=server_error&error_description=Oops'),
    ).resolves.toBe('invalid');
  });

  it('tells a refused session from one that could not be checked', async () => {
    mockAuth.setSession.mockResolvedValue({
      data: { session: null, user: null },
      error: apiError(400, 'refresh_token_already_used', 'Invalid Refresh Token'),
    });
    await expect(openRecoveryLink(tokens)).resolves.toBe('invalid');

    mockAuth.setSession.mockResolvedValue({
      data: { session: null, user: null },
      error: apiError(403, 'session_expired'),
    });
    await expect(openRecoveryLink(tokens)).resolves.toBe('expired');

    mockAuth.setSession.mockRejectedValue(new TypeError('Network request failed'));
    await expect(openRecoveryLink(tokens)).resolves.toBe('failed');
  });

  it('lets someone already signed in carry on when the link has been read before', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    await expect(openRecoveryLink('https://snapworth.app/new-password')).resolves.toBe('ready');

    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    await expect(openRecoveryLink(null)).resolves.toBe('invalid');
  });

  it('is unavailable without a Supabase project', async () => {
    mockConfigured = false;
    await expect(openRecoveryLink(tokens)).resolves.toBe('unavailable');
  });
});

describe('saveNewPassword', () => {
  it('saves the password on the signed-in account', async () => {
    mockAuth.updateUser.mockResolvedValue({ data: { user: {} }, error: null });

    await expect(saveNewPassword('a-new-password')).resolves.toBe('saved');
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'a-new-password' });
  });

  it('passes on Supabase’s own refusals', async () => {
    mockAuth.updateUser.mockResolvedValue({ data: null, error: apiError(422, 'same_password') });
    await expect(saveNewPassword('old-password')).resolves.toBe('same');

    mockAuth.updateUser.mockResolvedValue({ data: null, error: apiError(422, 'weak_password') });
    await expect(saveNewPassword('password')).resolves.toBe('weak');
  });

  it('asks for a new link once the link’s session has gone', async () => {
    mockAuth.updateUser.mockResolvedValue({
      data: null,
      error: { name: 'AuthSessionMissingError', status: 400, message: 'Auth session missing!' },
    });
    await expect(saveNewPassword('a-new-password')).resolves.toBe('expired');
  });

  it('fails plainly without a connection', async () => {
    mockAuth.updateUser.mockRejectedValue(new TypeError('Network request failed'));
    await expect(saveNewPassword('a-new-password')).resolves.toBe('failed');
  });
});
