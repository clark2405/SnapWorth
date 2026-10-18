import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo, type ReactNode } from 'react';

import {
  createLocalCommentRepository,
  createSupabaseClient,
  createSupabaseCommentRepository,
  screenWithRules,
  type LocalSeedComment,
} from '../adapters';
import { CommentServiceProvider } from '../features/feed';
import {
  previewPostDetail,
  previewPosts,
  previewProfile,
  type PreviewUser,
} from '../features/preview/sample-data';
import type { CommentService } from '../ports/services';
import { createCommentService } from '../services';
import type { UtcDateTime } from '../types/date-time';
import type { PublicProfile } from '../types/entities';
import type { UserId } from '../types/ids';

/** What a shell passes in from its environment (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY). */
export interface BackendConfig {
  readonly supabaseUrl?: string;
  readonly supabaseAnonKey?: string;
}

export interface AppServices {
  /** `supabase` when a project is configured; otherwise comments live on this device. */
  readonly backend: 'supabase' | 'device';
  readonly comments: CommentService;
}

const profileOf = (user: PreviewUser): PublicProfile => ({
  userId: `preview:${user.handle}` as UserId,
  handle: user.handle,
});

/** "2m ago" → a timestamp that many minutes before now, for seeding a fresh install. */
function agoToIso(ago: string, now: number): UtcDateTime {
  const match = /(\d+)\s*([mhd])/.exec(ago);
  const minutes = match
    ? Number(match[1]) * ({ m: 1, h: 60, d: 1440 } as const)[match[2] as 'm' | 'h' | 'd']
    : 0;
  return new Date(now - minutes * 60_000).toISOString() as UtcDateTime;
}

function previewSeed(): LocalSeedComment[] {
  const now = Date.now();
  return [...previewPosts, previewPostDetail].flatMap((post) =>
    post.comments.map((comment) => ({
      id: comment.id,
      postKey: post.id,
      parentId: comment.replyTo ?? null,
      body: comment.body,
      author: profileOf(comment.author),
      createdAt: agoToIso(comment.postedAgo, now),
    })),
  );
}

/**
 * The app's composition root: the one place that chooses infrastructure. With a Supabase
 * project configured, comments are stored, moderated and shared there; without one they are
 * kept on this device, under the same rules, so the app still works end to end.
 */
export function createAppServices(config: BackendConfig): AppServices {
  if (config.supabaseUrl && config.supabaseAnonKey) {
    const client = createSupabaseClient(
      { url: config.supabaseUrl, anonKey: config.supabaseAnonKey },
      AsyncStorage,
    );
    return {
      backend: 'supabase',
      comments: createCommentService(createSupabaseCommentRepository(client)),
    };
  }
  return {
    backend: 'device',
    comments: createCommentService(
      createLocalCommentRepository({
        store: AsyncStorage,
        viewer: profileOf(previewProfile.user),
        seed: previewSeed(),
        screen: screenWithRules,
      }),
    ),
  };
}

export function AppServicesProvider({
  config,
  children,
}: {
  readonly config: BackendConfig;
  readonly children: ReactNode;
}) {
  const services = useMemo(
    () => createAppServices(config),
    [config.supabaseUrl, config.supabaseAnonKey],
  );
  return <CommentServiceProvider service={services.comments}>{children}</CommentServiceProvider>;
}
