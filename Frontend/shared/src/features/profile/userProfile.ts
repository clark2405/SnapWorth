import { useCallback, useEffect, useState } from 'react';
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
  readonly rating: string;
  readonly isAdmin: boolean;
  readonly stats: {
    readonly checked: number;
    readonly listed: number;
    readonly sold: number;
  };
  readonly activity: {
    readonly listings: number;
    readonly votes: number;
    readonly conversations: number;
  };
}

export interface ProfileUpdateInput {
  readonly displayName?: string;
  readonly handle?: string;
  readonly location?: string;
  readonly bio?: string;
  readonly avatarUrl?: string | null;
}

/** Formats an ISO date into "Joined [Month] [Year]" or "Joined [Year]". */
export function formatJoinedDate(isoDate?: string | number | null): string {
  if (!isoDate) return previewProfile.joined;
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return previewProfile.joined;
    const month = date.toLocaleString('en-US', { month: 'long' });
    const year = date.getFullYear();
    return `Joined ${month} ${year}`;
  } catch {
    return `Joined ${new Date().getFullYear()}`;
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

/** Returns fallback profile details when Supabase is unconfigured or user details are missing. */
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
    location: textOf(meta.location) ?? previewProfile.location,
    bio: textOf(meta.bio) ?? previewProfile.bio,
    joined: formatJoinedDate(user.created_at),
    rating: textOf(meta.rating) ?? previewProfile.rating,
    isAdmin: deviceAdmin(),
    stats: {
      // Their own scans, counted once they've loaded.
      checked: 0,
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

/**
 * Fetches user profile from Supabase:
 * 1. Current user metadata & auth details
 * 2. `public.profiles` row (handle, avatar_url)
 * 3. Actual activity metrics (scans, listings and chats counts)
 */
export async function fetchUserProfile(authUser?: SessionUser | null): Promise<UserProfileDetails> {
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
  let avatarUrl = fallback.avatarUrl;
  let checkedCount = fallback.stats.checked;
  let listedCount = fallback.stats.listed;
  let soldCount = fallback.stats.sold;
  let chatCount = fallback.activity.conversations;
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
          .select('handle, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        if (profileRow) {
          if (profileRow.handle) handle = profileRow.handle;
          if (profileRow.avatar_url) avatarUrl = profileRow.avatar_url;
        }
      } catch {
        // Table or row may not exist yet
      }

      // Query activity stats
      try {
        const [checkedRes, listedRes, soldRes, chatRes] = await Promise.allSettled([
          supabase
            .from('scan_history')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('listings')
            .select('id', { count: 'exact', head: true })
            .eq('seller_id', user.id),
          supabase
            .from('listings')
            .select('id', { count: 'exact', head: true })
            .eq('seller_id', user.id)
            .eq('status', 'sold'),
          supabase
            .from('conversations')
            .select('id', { count: 'exact', head: true })
            .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`),
        ]);

        if (checkedRes.status === 'fulfilled' && typeof checkedRes.value.count === 'number') {
          checkedCount = checkedRes.value.count;
        }
        if (listedRes.status === 'fulfilled' && typeof listedRes.value.count === 'number') {
          listedCount = listedRes.value.count;
        }
        if (soldRes.status === 'fulfilled' && typeof soldRes.value.count === 'number') {
          soldCount = soldRes.value.count;
        }
        if (chatRes.status === 'fulfilled' && typeof chatRes.value.count === 'number') {
          chatCount = chatRes.value.count;
        }
      } catch {
        // Keep fallback counts
      }
    } catch {
      // Keep fallbacks
    }
  }

  return {
    ...fallback,
    handle,
    avatarUrl,
    isAdmin,
    stats: {
      checked: checkedCount,
      listed: listedCount,
      sold: soldCount,
    },
    activity: {
      listings: listedCount,
      votes: fallback.activity.votes,
      conversations: chatCount,
    },
  };
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
 * folder in Storage and set on `public.profiles` too, so others see it. The rest (name, place,
 * bio, and the photo's URL) is kept on the account.
 */
export async function updateUserProfile(
  updates: ProfileUpdateInput,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: true };
  }

  try {
    const supabase = getSupabase();
    const newPhoto =
      typeof updates.avatarUrl === 'string' && isDevicePhoto(updates.avatarUrl)
        ? updates.avatarUrl
        : undefined;
    let avatarUrl = updates.avatarUrl;

    let userId: string | undefined;
    if (updates.handle !== undefined || newPhoto !== undefined) {
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

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUserProfile(user);
      setProfile(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch user details');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh, user, status]);

  return {
    profile,
    loading,
    error,
    refresh,
  };
}

/** Returns the avatar image source for a profile (either remote URL or local fallback). */
export function avatarSourceFor(
  avatarUrl?: string | null,
  fallbackSource: ImageSourcePropType = previewProfile.user.avatar,
): ImageSourcePropType {
  if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim().length > 0) {
    return { uri: avatarUrl };
  }
  return fallbackSource;
}
