import {
  avatarSourceFor,
  buildFallbackProfile,
  fetchUserProfile,
  formatJoinedDate,
} from './userProfile';

describe('userProfile', () => {
  it('formats joined date accurately from ISO strings', () => {
    expect(formatJoinedDate('2026-03-15T12:00:00Z')).toBe('Joined March 2026');
    expect(formatJoinedDate('2025-10-01T08:30:00Z')).toBe('Joined October 2025');
  });

  it('builds fallback profile when no user is provided', () => {
    const profile = buildFallbackProfile(null);
    expect(profile.displayName).toBe('Rico Santos');
    expect(profile.handle).toBe('retro_curator');
    expect(profile.stats.checked).toBeGreaterThan(0);
  });

  it('builds profile using authenticated user metadata', () => {
    const mockUser = {
      id: 'usr_123',
      email: 'clark@example.com',
      created_at: '2026-05-10T00:00:00Z',
      user_metadata: {
        full_name: 'Clark Kent',
        handle: 'superclark',
        location: 'Metropolis',
        bio: 'Reporter and collector',
      },
    };

    const profile = buildFallbackProfile(mockUser);
    expect(profile.displayName).toBe('Clark Kent');
    expect(profile.handle).toBe('superclark');
    expect(profile.email).toBe('clark@example.com');
    expect(profile.location).toBe('Metropolis');
    expect(profile.bio).toBe('Reporter and collector');
    expect(profile.joined).toBe('Joined May 2026');
  });

  it('resolves avatar source correctly for remote and fallback images', () => {
    const fallbackImage = { testUri: 'fallback.png' } as any;
    const remote = avatarSourceFor('https://images.example.com/avatar.jpg', fallbackImage);
    expect(remote).toEqual({ uri: 'https://images.example.com/avatar.jpg' });

    const local = avatarSourceFor(null, fallbackImage);
    expect(local).toBe(fallbackImage);
  });

  it('fetches user profile safely and resolves complete profile', async () => {
    const mockUser = {
      id: 'usr_456',
      email: 'bruce@example.com',
      created_at: '2026-01-20T00:00:00Z',
      user_metadata: {
        full_name: 'Bruce Wayne',
        handle: 'brucewayne',
        role: 'admin',
      },
    };

    const profile = await fetchUserProfile(mockUser);
    expect(profile.id).toBe('usr_456');
    expect(profile.displayName).toBe('Bruce Wayne');
    expect(profile.handle).toBe('brucewayne');
    expect(profile.isAdmin).toBe(true);
    expect(profile.joined).toBe('Joined January 2026');
  });
});
