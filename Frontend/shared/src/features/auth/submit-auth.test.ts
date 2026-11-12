import { isSupabaseConfigured, performAuth } from './authApi';
import { missingFromAuthInput, submitAuth } from './submit-auth';

jest.mock('./authApi', () => ({
  isSupabaseConfigured: jest.fn(),
  performAuth: jest.fn(),
}));
jest.mock('../session', () => ({}));

const configured = jest.mocked(isSupabaseConfigured);
const auth = jest.mocked(performAuth);

const login = {
  mode: 'login' as const,
  email: 'pia@example.com',
  password: 'secret1',
  fullName: '',
};

beforeEach(() => {
  jest.resetAllMocks();
  configured.mockReturnValue(true);
});

describe('missingFromAuthInput', () => {
  it('names what is missing', () => {
    expect(missingFromAuthInput({ email: '', password: '' })).toBe(
      'Enter your email and password.',
    );
    expect(missingFromAuthInput({ email: '  ', password: 'x' })).toBe('Enter your email.');
    expect(missingFromAuthInput({ email: 'a@b.c', password: '' })).toBe('Enter your password.');
    expect(missingFromAuthInput({ email: 'a@b.c', password: 'x' })).toBeNull();
  });
});

describe('submitAuth with a Supabase project', () => {
  it.each([
    ['empty fields', { ...login, email: '', password: '' }],
    ['no password', { ...login, password: '' }],
    ['no email', { ...login, email: '   ' }],
  ])('never starts a session from %s, and sends nothing', async (_name, input) => {
    for (const mode of ['login', 'signup'] as const) {
      const outcome = await submitAuth({ ...input, mode });
      expect(outcome.kind).toBe('invalid');
    }
    expect(auth).not.toHaveBeenCalled();
  });

  it('signs in a real account', async () => {
    const user = { id: 'usr_1', email: 'pia@example.com' };
    auth.mockResolvedValue({ data: { user, session: {} }, error: null } as never);
    expect(await submitAuth(login)).toEqual({ kind: 'signed-in', user });
    expect(auth).toHaveBeenCalledWith(expect.objectContaining({ email: 'pia@example.com' }));
  });

  it('reports a refusal instead of starting a session', async () => {
    auth.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } } as never);
    expect(await submitAuth(login)).toEqual({
      kind: 'failed',
      message: 'Invalid login credentials',
    });
  });

  it('reports a connection failure instead of starting a session', async () => {
    auth.mockRejectedValue(new Error('Failed to fetch'));
    expect(await submitAuth(login)).toEqual({ kind: 'failed', message: 'Failed to fetch' });
  });

  it('asks to confirm the email when signing up gives no session yet', async () => {
    auth.mockResolvedValue({ data: { user: { id: 'u' }, session: null }, error: null } as never);
    expect(await submitAuth({ ...login, mode: 'signup' })).toEqual({ kind: 'check-email' });
  });
});

describe('submitAuth with no Supabase project', () => {
  beforeEach(() => configured.mockReturnValue(false));

  it('still needs an email and password', async () => {
    expect((await submitAuth({ ...login, email: '', password: '' })).kind).toBe('invalid');
  });

  it('starts a session on the device', async () => {
    const outcome = await submitAuth(login);
    expect(outcome).toMatchObject({
      kind: 'local',
      user: { id: 'local_user', email: 'pia@example.com' },
    });
    expect(auth).not.toHaveBeenCalled();
  });
});
