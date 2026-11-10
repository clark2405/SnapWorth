import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import {
  createLocalChatRepository,
  createLocalCollectionRepository,
  createLocalCommentRepository,
  createLocalFeedRepository,
  createLocalHanapRepository,
  createLocalMarketplaceRepository,
  createLocalSukiRepository,
  createSupabaseAccountObserver,
  createSupabaseChatRepository,
  createSupabaseCollectionRepository,
  createSupabaseCommentRepository,
  createSupabaseFeedRepository,
  createSupabaseHanapRepository,
  createSupabaseMarketplaceRepository,
  createSupabaseSukiRepository,
  createPhotoPricingService,
  deviceAccount,
  screenWithRules,
  type LocalSeedComment,
  type LocalSeedConversation,
} from '../adapters';
import { getSupabase } from '../adapters/supabaseClient';
import { ChatServiceProvider } from '../features/chat/chat-state';
import { SukiProvider } from '../features/chat/suki';
import {
  buildPreviewFeedPosts,
  buildPreviewFeedVotes,
  CommentServiceProvider,
  FeedProvider,
} from '../features/feed';
import { HanapProvider } from '../features/hanap/hanap-state';
import { GuessProvider } from '../features/guess/guess-state';
import { CollectionsProvider } from '../features/history/collections';
import { ScanHistoryProvider } from '../features/history/scan-history-state';
import { PaidPricesProvider } from '../features/history/paid-prices';
import {
  buildPreviewMarketListings,
  buildPreviewSellerSeeds,
  MarketplaceProvider,
} from '../features/marketplace/marketplace-state';
import {
  previewChatListingKey,
  previewConversation,
  previewConversations,
  previewCollections,
  previewHanap,
  previewListings,
  previewPaidPrices,
  previewPostDetail,
  previewPosts,
  previewPriceAlerts,
  previewProfile,
  previewUsers,
  type PreviewMessage,
  type PreviewUser,
} from '../features/preview/sample-data';
import type { AccountObserver } from '../ports/account';
import type { CollectionRepository } from '../ports/collections';
import type { FeedRepository } from '../ports/feed';
import type { HanapRepository } from '../ports/hanap';
import type { MarketplaceRepository } from '../ports/marketplace';
import type { ChatService, CommentService } from '../ports/services';
import type { SukiRepository } from '../ports/suki';
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
  readonly feed: FeedRepository;
  readonly hanap: HanapRepository;
  readonly marketplace: MarketplaceRepository;
  readonly suki: SukiRepository;
  readonly pricing: PhotoPricingService;
  /** Who is signed in, for what's kept per account. */
  readonly account: AccountObserver;
  /** Where an account's collections are kept. */
  readonly collectionsFor: (accountId: string) => CollectionRepository;
  /** The Supabase connection, for the stores that take one directly (saved scans). */
  readonly supabaseClient?: SupabaseClient;
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
  'retro-walkman': previewUsers.sugboHype,
  'keychron-keyboard': previewUsers.mariaCruz,
  'nike-teal-windbreaker': previewUsers.retroCurator,
  'colour-block-windbreaker': previewUsers.sugboHype,
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
    const collections = createSupabaseCollectionRepository(client, { device: AsyncStorage });
    return {
      backend: 'supabase',
      comments: createCommentService(createSupabaseCommentRepository(client)),
      chats: createChatService(createSupabaseChatRepository(client)),
      feed: createSupabaseFeedRepository(client),
      hanap: createSupabaseHanapRepository(client),
      marketplace: createSupabaseMarketplaceRepository(client),
      suki: createSupabaseSukiRepository(client),
      pricing: createPhotoPricingService(client),
      account: createSupabaseAccountObserver(client),
      // Row-level security keeps each account to its own; collections this phone kept before
      // move into the account that owns their things.
      collectionsFor: () => collections,
      supabaseClient: client,
    };
  }
  const deviceCollections = createLocalCollectionRepository({
    store: AsyncStorage,
    seed: previewCollections,
  });
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
    hanap: createLocalHanapRepository({
      store: AsyncStorage,
      viewer: profileOf(previewProfile.user),
      seed: previewHanap.map(({ minutesAgo, ...entry }) => ({
        ...entry,
        createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString() as UtcDateTime,
      })),
      screen: screenWithRules,
    }),
    feed: createLocalFeedRepository({
      seed: buildPreviewFeedPosts(),
      seedVotes: buildPreviewFeedVotes(),
      viewerHandle: previewProfile.user.handle,
    }),
    marketplace: createLocalMarketplaceRepository({
      store: AsyncStorage,
      viewer: profileOf(previewProfile.user),
      seedListings: buildPreviewMarketListings(),
      seedSaved: previewPriceAlerts,
      seedSellers: buildPreviewSellerSeeds(),
    }),
    account: deviceAccount,
    collectionsFor: () => deviceCollections,
    // The windbreaker's buyer is already the preview owner's suki.
    suki: createLocalSukiRepository({
      store: AsyncStorage,
      seed: { [`seller:${profileOf(previewUsers.sugboHype).userId}`]: 10 },
    }),
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
        <ChatServiceProvider service={services.chats}>
          <HanapProvider repository={services.hanap}>
            <MarketplaceProvider repository={services.marketplace}>
              <FeedProvider repository={services.feed}>
                <SukiProvider repository={services.suki}>
                  {/* Saved scans, and what was paid for each: in Supabase with a backend, on the
                    phone without. */}
                  <ScanHistoryProvider
                    client={services.supabaseClient ?? null}
                    store={AsyncStorage}
                  >
                    {/* The sample items' prices: kept on the device without a backend; with one
                      they're a preview, so they aren't kept. */}
                    <PaidPricesProvider
                      store={services.backend === 'device' ? AsyncStorage : undefined}
                      seed={previewPaidPrices}
                    >
                      <CollectionsProvider
                        account={services.account}
                        repositoryFor={services.collectionsFor}
                      >
                        {/* Guess the worth needs no account, so its days stay on the device. */}
                        <GuessProvider store={AsyncStorage}>{children}</GuessProvider>
                      </CollectionsProvider>
                    </PaidPricesProvider>
                  </ScanHistoryProvider>
                </SukiProvider>
              </FeedProvider>
            </MarketplaceProvider>
          </HanapProvider>
        </ChatServiceProvider>
      </CommentServiceProvider>
    </PhotoPricingContext.Provider>
  );
}
