import { useCallback, useEffect, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';

import { getSupabase, isSupabaseConfigured } from '../../adapters/supabaseClient';
import {
  previewConversations,
  previewHistory,
  previewProfile,
  previewVotesCast,
} from '../preview/sample-data';
import { useSession } from '../session';

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

/** Returns fallback profile details when Supabase is unconfigured or user details are missing. */
export function buildFallbackProfile(user?: any | null): UserProfileDetails {
  if (!user) {
    return {
      id: 'demo-user',
      email: 'member@snapworth.com',
      displayName: previewProfile.displayName,
      handle: previewProfile.user.handle,
      avatarUrl: null,
      location: previewProfile.location,
      bio: previewProfile.bio,
      joined: previewProfile.joined,
      rating: previewProfile.rating,
      isAdmin: previewProfile.isAdmin,
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

  const meta = (user.user_metadata || {}) as Record<string, any>;
  const emailName = user.email ? user.email.split('@')[0] : 'User';
  const displayName = meta.full_name || meta.name || meta.displayName || emailName;
  const handle =
    meta.handle ||
    meta.username ||
    (user.email ? user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_') : 'user');

  return {
    id: user.id || 'current-user',
    email: user.email || '',
    displayName,
    handle,
    avatarUrl: meta.avatar_url || meta.picture || null,
    location: meta.location || previewProfile.location,
    bio: meta.bio || previewProfile.bio,
    joined: formatJoinedDate(user.created_at),
    rating: meta.rating || previewProfile.rating,
    isAdmin: Boolean(
      meta.role === 'admin' ||
        meta.is_admin ||
        user.app_metadata?.role === 'admin' ||
        user.email?.endsWith('@snapworth.com'),
    ),
    stats: {
      checked: previewHistory.length,
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
 * 3. Actual activity metrics (listings count, chats count)
 */
export async function fetchUserProfile(authUser?: any | null): Promise<UserProfileDetails> {
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
  let listedCount = fallback.stats.listed;
  let soldCount = fallback.stats.sold;
  let chatCount = fallback.activity.conversations;

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();

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
        const [listedRes, soldRes, chatRes] = await Promise.allSettled([
          supabase.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', user.id),
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
    stats: {
      checked: fallback.stats.checked,
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

/** Updates user profile in Supabase (auth metadata and public.profiles row). */
export async function updateUserProfile(
  updates: ProfileUpdateInput,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: true };
  }

  try {
    const supabase = getSupabase();
    const userMetaUpdates: Record<string, any> = {};
    if (updates.displayName !== undefined) userMetaUpdates.full_name = updates.displayName;
    if (updates.handle !== undefined) userMetaUpdates.handle = updates.handle;
    if (updates.location !== undefined) userMetaUpdates.location = updates.location;
    if (updates.bio !== undefined) userMetaUpdates.bio = updates.bio;
    if (updates.avatarUrl !== undefined) userMetaUpdates.avatar_url = updates.avatarUrl;

    const { error: userError } = await supabase.auth.updateUser({
      data: userMetaUpdates,
    });
    if (userError) throw userError;

    // Also attempt to update public.profiles if row exists
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const profileUpdates: Record<string, any> = {};
        if (updates.handle !== undefined) profileUpdates.handle = updates.handle;
        if (updates.avatarUrl !== undefined) profileUpdates.avatar_url = updates.avatarUrl;

        if (Object.keys(profileUpdates).length > 0) {
          await supabase.from('profiles').update(profileUpdates).eq('id', user.id);
        }
      }
    } catch {
      // Ignore if profiles table is not directly updatable
    }

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
