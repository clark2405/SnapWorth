import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';

import { fetchIsAdmin } from '../../adapters/supabase/admin-role';
import { uploadAvatar } from '../../adapters/supabase/photo-storage';
import { getSupabase, isSupabaseConfigured } from '../../adapters/supabaseClient';
import { previewConversations, previewProfile, previewVotesCast } from '../preview/sample-data';
import { useSession, type SessionUser } from '../session';

export interface UserProfileDetails {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly handle: string;
  readonly avatarUrl?: string | null;
  readonly location: string;
  readonly bio: string;
  readonly joined: string;
  /** Sellers aren't rated yet, so a real account has none; the preview profile has one. */
  readonly rating: string | null;
  readonly isAdmin: boolean;
  /**
   * What the account has done, counted by the database. `null` means the count couldn't be loaded:
   * that is not the same as none, and a screen shows it as unknown rather than as 0.
   */
  readonly stats: {
    readonly checked: number | null;
    readonly listed: number | null;
    readonly sold: number | null;
  };
  readonly activity: {
    readonly listings: number | null;
    readonly votes: number | null;
    readonly conversations: number | null;
  };
}

export interface ProfileUpdateInput {
  readonly displayName?: string;
  readonly handle?: string;
  readonly location?: string;
  readonly bio?: string;
  readonly avatarUrl?: string | null;
}

/** Formats an ISO date into "Joined [Month] [Year]"; nothing when the date isn't known. */
export function formatJoinedDate(isoDate?: string | number | null): string {
  if (!isoDate) return '';
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return '';
    const month = date.toLocaleString('en-US', { month: 'long' });
    const year = date.getFullYear();
    return `Joined ${month} ${year}`;
  } catch {
    return '';
  }
}

/** The first value that is a non-empty string. Metadata is whatever was saved, so check each. */
function textOf(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

/** The id of the preview profile shown with nobody signed in. */
export const previewProfileId = 'demo-user';

/**
 * Whether the preview owner is an admin. Only a build with no backend says so, to show the
 * sample review queue: with one, the database decides (`fetchIsAdmin`), and the answer starts
 * as no. Never read from the account's metadata or email, which people control.
 */
function deviceAdmin(): boolean {
  return !isSupabaseConfigured() && previewProfile.isAdmin;
}

/**
 * The profile as far as the account itself says: the sample profile when nobody is signed in (a
 * preview), else only what the account holds, and zero for what a database has yet to count. A
 * real account never gets the sample's bio, place, rating or numbers.
 */
export function buildFallbackProfile(user?: SessionUser | null): UserProfileDetails {
  if (!user) {
    return {
      id: previewProfileId,
      email: 'member@snapworth.com',
      displayName: previewProfile.displayName,
      handle: previewProfile.user.handle,
      avatarUrl: null,
      location: previewProfile.location,
      bio: previewProfile.bio,
      joined: previewProfile.joined,
      rating: previewProfile.rating,
      isAdmin: deviceAdmin(),
      stats: {
        checked: previewProfile.stats.checked,
        listed: previewProfile.stats.listed,
        sold: previewProfile.stats.sold,
      },
      activity: {
        listings: previewProfile.stats.listed,
        votes: previewVotesCast.length,
        conversations: previewConversations.length,
      },
    };
  }

  const meta = user.user_metadata ?? {};
  const emailName = user.email?.split('@')[0];
  const displayName = textOf(meta.full_name, meta.name, meta.displayName) ?? (emailName || 'User');
  const handle =
    textOf(meta.handle, meta.username) ??
    (emailName || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '_');

  return {
    id: user.id || 'current-user',
    email: user.email || '',
    displayName,
    handle,
    avatarUrl: textOf(meta.avatar_url, meta.picture) ?? null,
    location: textOf(meta.location) ?? '',
    bio: textOf(meta.bio) ?? '',
    joined: formatJoinedDate(user.created_at),
    rating: null,
    isAdmin: deviceAdmin(),
    // Counted once they've loaded: their own scans, listings, sales, votes and chats.
    stats: { checked: 0, listed: 0, sold: 0 },
    activity: { listings: 0, votes: 0, conversations: 0 },
  };
}

/**
 * Fetches user profile from Supabase:
 * 1. Current user metadata & auth details
 * 2. `public.profiles` row (handle, avatar_url, display_name, bio, location)
 * 3. Actual activity metrics (scans, listings and chats counts)
 */
export function fetchUserProfile(authUser?: SessionUser | null): Promise<UserProfileDetails> {
  // Several parts of a screen ask for the profile at once (the header button, the screen itself):
  // they share one load, so the database is asked once, not once each. A save ends the sharing so
  // nobody is handed what was loaded before it.
  const key = authUser?.id ?? '';
  const loading = inFlight.get(key);
  if (loading) return loading;
  const load = loadUserProfile(authUser).finally(() => {
    if (inFlight.get(key) === load) inFlight.delete(key);
  });
  inFlight.set(key, load);
  return load;
}

const inFlight = new Map<string, Promise<UserProfileDetails>>();

async function loadUserProfile(authUser?: SessionUser | null): Promise<UserProfileDetails> {
  let user = authUser;

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();
      if (!user) {
        const { data } = await supabase.auth.getUser();
        user = data.user;
      }
    } catch {
      // Keep existing user if query fails
    }
  }

  if (!user) {
    return buildFallbackProfile(null);
  }

  const fallback = buildFallbackProfile(user);
  let handle = fallback.handle;
  let displayName = fallback.displayName;
  let bio = fallback.bio;
  let location = fallback.location;
  let avatarUrl = fallback.avatarUrl;
  let checkedCount: number | null = fallback.stats.checked;
  let listedCount: number | null = fallback.stats.listed;
  let soldCount: number | null = fallback.stats.sold;
  let chatCount: number | null = fallback.activity.conversations;
  let voteCount: number | null = fallback.activity.votes;
  let isAdmin = fallback.isAdmin;

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();

      // Only the database grants the role; this is asking it, not deciding.
      isAdmin = await fetchIsAdmin(supabase);

      // Query public.profiles
      try {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('handle, avatar_url, display_name, bio, location')
          .eq('id', user.id)
          .maybeSingle();

        // What the profile holds is what others see, so it wins over the account's own copy.
        if (profileRow) {
          if (profileRow.handle) handle = profileRow.handle;
          if (profileRow.avatar_url) avatarUrl = profileRow.avatar_url;
          displayName = textOf(profileRow.display_name) ?? displayName;
          bio = textOf(profileRow.bio) ?? bio;
          location = textOf(profileRow.location) ?? location;
        }
      } catch {
        // Table or row may not exist yet
      }

      // Query activity stats
      try {
        const [checkedRes, listedRes, soldRes, chatRes, voteRes] = await Promise.allSettled([
          supabase
            .from('scan_history')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('listings')
            .select('id', { count: 'exact', head: true })
            .eq('seller_id', user.id)
            .neq('status', 'removed'),
          supabase
            .from('listings')
            .select('id', { count: 'exact', head: true })
            .eq('seller_id', user.id)
            .eq('status', 'sold'),
          supabase
            .from('conversations')
            .select('id', { count: 'exact', head: true })
            .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`),
          supabase
            .from('votes')
            .select('post_id', { count: 'exact', head: true })
            .eq('user_id', user.id),
        ]);

        // A count that couldn't be loaded is unknown (null), not zero.
        checkedCount = countOf(checkedRes);
        listedCount = countOf(listedRes);
        soldCount = countOf(soldRes);
        chatCount = countOf(chatRes);
        voteCount = countOf(voteRes);
      } catch {
        checkedCount = listedCount = soldCount = chatCount = voteCount = null;
      }
    } catch {
      // Keep fallbacks
    }
  }

  return {
    ...fallback,
    handle,
    displayName,
    bio,
    location,
    avatarUrl,
    isAdmin,
    stats: {
      checked: checkedCount,
      listed: listedCount,
      sold: soldCount,
    },
    activity: {
      listings: listedCount,
      votes: voteCount,
      conversations: chatCount,
    },
  };
}

/** A head-count query's answer: its number, or null when it failed (an error is not a zero). */
function countOf(
  result: PromiseSettledResult<{ readonly count: number | null; readonly error?: unknown }>,
): number | null {
  if (result.status !== 'fulfilled' || result.value.error) return null;
  return typeof result.value.count === 'number' ? result.value.count : null;
}

/** What to tell someone whose new handle the database refused, by Postgres error code. */
function handleRefusal(code?: string): string {
  if (code === '23505') return 'That handle is taken. Try another.';
  if (code === '23514') return 'A handle is 3 to 24 lowercase letters, numbers or underscores.';
  return 'Your handle couldn’t be saved. Try again.';
}

/** A photo on this device (picked or taken), rather than one already online. */
function isDevicePhoto(uri: string): boolean {
  return !/^https?:\/\//i.test(uri);
}

/**
 * Updates user profile in Supabase. The handle goes to the `public.profiles` row first, since
 * that's the one comments and chats show, and a handle someone else has is refused there before
 * anything else is saved. A new photo picked on the device is uploaded to the person's avatar
 * folder in Storage and set on `public.profiles` too, so others see it. The name, place and bio
 * go to `public.profiles` as well, which is what seller pages show. The account's own copy of all
 * of them is kept in step, since it is what a signed-in person's own screens start from.
 */
export async function updateUserProfile(
  updates: ProfileUpdateInput,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: true };
  }
  // Whatever is being loaded now predates this save.
  inFlight.clear();

  try {
    const supabase = getSupabase();
    const newPhoto =
      typeof updates.avatarUrl === 'string' && isDevicePhoto(updates.avatarUrl)
        ? updates.avatarUrl
        : undefined;
    let avatarUrl = updates.avatarUrl;

    // The public details, which seller pages read from `public.profiles`.
    const details: Record<string, string> = {};
    if (updates.displayName !== undefined) details.display_name = updates.displayName;
    if (updates.bio !== undefined) details.bio = updates.bio;
    if (updates.location !== undefined) details.location = updates.location;

    let userId: string | undefined;
    if (updates.handle !== undefined || newPhoto !== undefined || Object.keys(details).length > 0) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'Sign in again to save your profile.' };
      userId = user.id;
    }

    if (updates.handle !== undefined && userId) {
      const { data, error } = await supabase
        .from('profiles')
        .update({ handle: updates.handle })
        .eq('id', userId)
        .select('id');
      // No row back means the database let nothing change.
      if (error || !data?.length) return { success: false, error: handleRefusal(error?.code) };
    }

    if (Object.keys(details).length > 0 && userId) {
      const { data, error } = await supabase
        .from('profiles')
        .update(details)
        .eq('id', userId)
        .select('id');
      if (error || !data?.length) {
        return { success: false, error: 'Your profile details couldn’t be saved. Try again.' };
      }
    }

    if (newPhoto !== undefined && userId) {
      const photoRefused = { success: false, error: 'Your photo couldn’t be saved. Try again.' };
      try {
        avatarUrl = await uploadAvatar(supabase, userId, newPhoto);
      } catch {
        return photoRefused;
      }
      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId)
        .select('id');
      if (error || !data?.length) return photoRefused;
    }

    const userMetaUpdates: Record<string, string | null> = {};
    if (updates.displayName !== undefined) userMetaUpdates.full_name = updates.displayName;
    if (updates.handle !== undefined) userMetaUpdates.handle = updates.handle;
    if (updates.location !== undefined) userMetaUpdates.location = updates.location;
    if (updates.bio !== undefined) userMetaUpdates.bio = updates.bio;
    if (avatarUrl !== undefined) userMetaUpdates.avatar_url = avatarUrl;

    const { error: userError } = await supabase.auth.updateUser({
      data: userMetaUpdates,
    });
    if (userError) throw userError;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update profile',
    };
  }
}

/** Hook to fetch, access and refresh the current user's profile details. */
export function useUserProfile() {
  const { user, status } = useSession();
  const [profile, setProfile] = useState<UserProfileDetails>(() => buildFallbackProfile(user));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Moves on with each load and each account change, so an older answer is thrown away. */
  const generation = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const mine = ++generation.current;
    // Only the latest load, for the account still signed in, may change what's on screen, and
    // nothing may once the screen has gone.
    const current = () => mounted.current && mine === generation.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUserProfile(user);
      if (current()) setProfile(data);
    } catch (e) {
      if (current()) setError(e instanceof Error ? e.message : 'Failed to fetch user details');
    } finally {
      if (current()) setLoading(false);
    }
  }, [user]);

  // A different account starts from what it holds itself, at once: the last one's profile (and
  // counts) never show for it while its own load is on the way.
  const shownFor = useRef<string | null>(user?.id ?? null);
  useEffect(() => {
    const account = user?.id ?? null;
    if (account !== shownFor.current) {
      shownFor.current = account;
      generation.current += 1;
      setProfile((prev) => (prev.id === account ? prev : buildFallbackProfile(user)));
    }
    void refresh();
  }, [refresh, user, status]);

  return {
    profile,
    loading,
    error,
    refresh,
  };
}

/**
 * The avatar image source for a profile: its photo, else `fallbackSource`. With no fallback
 * there's no picture and the screen shows the person's initial.
 */
export function avatarSourceFor(
  avatarUrl?: string | null,
  fallbackSource: ImageSourcePropType | null = null,
): ImageSourcePropType | null {
  if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim().length > 0) {
    return { uri: avatarUrl };
  }
  return fallbackSource;
}
