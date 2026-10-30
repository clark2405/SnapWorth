import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import {
  createLocalChatRepository,
  createLocalCommentRepository,
  createSupabaseChatRepository,
  createSupabaseCommentRepository,
  createPhotoPricingService,
  screenWithRules,
  type LocalSeedComment,
  type LocalSeedConversation,
} from '../adapters';
import { getSupabase } from '../adapters/supabaseClient';
import { ChatServiceProvider } from '../features/chat/chat-state';
import { CommentServiceProvider } from '../features/feed';
import {
  previewChatListingKey,
  previewConversation,
  previewConversations,
  previewListings,
  previewPostDetail,
  previewPosts,
  previewProfile,
  previewUsers,
  type PreviewMessage,
  type PreviewUser,
} from '../features/preview/sample-data';
import type { ChatService, CommentService } from '../ports/services';
import { createChatService, createCommentService } from '../services';
import type { UtcDateTime } from '../types/date-time';
import type { ChatListing, PublicProfile } from '../types/entities';
import type { UserId } from '../types/ids';
import type { PhotoPricingService } from '../types/photo-estimate';

/** What a shell passes in from its environment (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY). */
export interface BackendConfig {
  readonly supabaseUrl?: string;
  readonly supabaseAnonKey?: string;
}

export interface AppServices {
  /** `supabase` when a project is configured; otherwise comments live on this device. */
  readonly backend: 'supabase' | 'device';
  readonly comments: CommentService;
  readonly chats: ChatService;
  readonly pricing: PhotoPricingService;
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

/** Who sells each market listing; the backend's seed (02_chat_listings.sql) matches. */
const previewSellerByListing: Readonly<Record<string, PreviewUser>> = {
  'polaroid-sun-600': previewUsers.mariaCruz,
  'air-jordan-1-bred': previewUsers.justinV,
  'retro-walkman': previewUsers.manilaHype,
  'keychron-keyboard': previewUsers.mariaCruz,
  'nike-teal-windbreaker': previewUsers.retroCurator,
  'colour-block-windbreaker': previewUsers.manilaHype,
  'black-puffer-jacket': previewUsers.justinV,
  'polaroid-film-bundle': previewUsers.mariaCruz,
};

function previewListingFor(key: string) {
  const listing = previewListings.find((entry) => entry.id === key);
  const seller = previewSellerByListing[key];
  if (!listing || !seller) return undefined;
  const chatListing: ChatListing = {
    key: listing.id,
    title: listing.title,
    askingPricePhp: listing.askingPrice,
  };
  return { listing: chatListing, seller: profileOf(seller) };
}

/** Parses the samples' "10:30 AM", "Yesterday", "Mon" or "Sep 28" into a recent timestamp. */
function sentAtToIso(sentAt: string, now: Date): UtcDateTime {
  const day = new Date(now);
  const time = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(sentAt);
  if (time) {
    const hours = (Number(time[1]) % 12) + (time[3] === 'PM' ? 12 : 0);
    day.setHours(hours, Number(time[2]), 0, 0);
    if (day > now) day.setDate(day.getDate() - 1);
    return day.toISOString() as UtcDateTime;
  }
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (sentAt === 'Yesterday') day.setDate(day.getDate() - 1);
  else if (weekdays.includes(sentAt)) {
    const back = (day.getDay() - weekdays.indexOf(sentAt) + 7) % 7 || 7;
    day.setDate(day.getDate() - back);
  } else {
    const parsed = new Date(`${sentAt}, ${now.getFullYear()}`);
    if (!Number.isNaN(parsed.getTime())) day.setTime(parsed.getTime());
    if (day > now) day.setFullYear(day.getFullYear() - 1);
  }
  day.setHours(12, 0, 0, 0);
  return day.toISOString() as UtcDateTime;
}

function previewChatSeed(): LocalSeedConversation[] {
  const now = new Date();
  return previewConversations.map((conversation) => {
    const listing: ChatListing = {
      key: previewChatListingKey(conversation.itemTitle),
      title: conversation.itemTitle,
      askingPricePhp:
        conversation.id === previewConversation.id
          ? previewConversation.item.askingPrice
          : (previewListings.find((entry) => entry.title === conversation.itemTitle)?.askingPrice ??
            2000),
    };
    // The one sample with a whole thread; the rest start from their latest message.
    const messages =
      conversation.id === previewConversation.id
        ? previewConversation.messages.map((message: PreviewMessage, index) => ({
            id: `${conversation.id}-${message.id}`,
            fromMe: message.mine,
            body: message.body,
            offer: message.offer
              ? { amountPhp: message.offer.amount, status: message.offer.status }
              : undefined,
            createdAt: new Date(
              Date.parse(sentAtToIso(message.sentAt, now)) + index,
            ).toISOString() as UtcDateTime,
          }))
        : [
            {
              id: `${conversation.id}-latest`,
              fromMe: conversation.lastFromMe,
              body: conversation.lastMessage,
              createdAt: sentAtToIso(conversation.sentAt, now),
            },
          ];
    return {
      id: conversation.id,
      listing,
      other: profileOf(conversation.with),
      iAmSeller: true,
      closed: conversation.closed,
      unread: conversation.unread,
      messages,
    };
  });
}

/** The other side of a demo chat, answering after a pause. */
const demoReplies = [
  'Sounds good — let me know when works for you.',
  'Great, I can do that.',
  'Perfect, talk soon!',
] as const;

/**
 * The app's composition root: the one place that chooses infrastructure. With a Supabase
 * project configured, comments are stored, moderated and shared there; without one they are
 * kept on this device, under the same rules, so the app still works end to end.
 */
export function createAppServices(config: BackendConfig): AppServices {
  if (config.supabaseUrl && config.supabaseAnonKey) {
    const client = getSupabase({ url: config.supabaseUrl, anonKey: config.supabaseAnonKey });
    return {
      backend: 'supabase',
      comments: createCommentService(createSupabaseCommentRepository(client)),
      chats: createChatService(createSupabaseChatRepository(client)),
      pricing: createPhotoPricingService(client),
    };
  }
  return {
    backend: 'device',
    pricing: {
      async estimate() {
        throw new Error(
          'Price estimation needs a connection to the server. Please try again later.',
        );
      },
    },
    comments: createCommentService(
      createLocalCommentRepository({
        store: AsyncStorage,
        viewer: profileOf(previewProfile.user),
        seed: previewSeed(),
        screen: screenWithRules,
      }),
    ),
    chats: createChatService(
      createLocalChatRepository({
        store: AsyncStorage,
        viewer: profileOf(previewProfile.user),
        seed: previewChatSeed(),
        findListing: previewListingFor,
        simulateReplies: { delayMs: 1200, replies: demoReplies },
      }),
    ),
  };
}

const PhotoPricingContext = createContext<PhotoPricingService | null>(null);

export function usePhotoPricing(): PhotoPricingService {
  const pricing = useContext(PhotoPricingContext);
  if (!pricing) throw new Error('Photo pricing requires AppServicesProvider.');
  return pricing;
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
  return (
    <PhotoPricingContext.Provider value={services.pricing}>
      <CommentServiceProvider service={services.comments}>
        <ChatServiceProvider service={services.chats}>{children}</ChatServiceProvider>
      </CommentServiceProvider>
    </PhotoPricingContext.Provider>
  );
}
