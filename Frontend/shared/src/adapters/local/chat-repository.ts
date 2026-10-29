import type { ChatEvent, ChatListener, ChatRepository } from '../../ports/chat';
import type { UtcDateTime } from '../../types/date-time';
import type {
  ChatListing,
  ChatMeetup,
  ChatOffer,
  ConversationSummary,
  Message,
  OutgoingMessage,
  PublicProfile,
} from '../../types/entities';
import type { ConversationId, MessageId } from '../../types/ids';
import { newUuid } from '../../types/ids';
import { findMeetupSpot } from '../../types/meetup-spots';
import { err, ok } from '../../types/result';
import type { KeyValueStore } from './comment-repository';

export interface LocalSeedMessage {
  readonly id: string;
  readonly fromMe: boolean;
  readonly body: string;
  readonly offer?: ChatOffer;
  readonly meetup?: ChatMeetup;
  readonly createdAt: UtcDateTime;
}

export interface LocalSeedConversation {
  readonly id: string;
  readonly listing: ChatListing;
  readonly other: PublicProfile;
  readonly iAmSeller: boolean;
  readonly closed?: 'sold' | 'archived';
  /** How many of the latest messages the viewer hasn't read yet. */
  readonly unread: number;
  /** Oldest first. */
  readonly messages: readonly LocalSeedMessage[];
}

interface StoredConversation {
  readonly id: string;
  readonly listing: ChatListing;
  readonly other: PublicProfile;
  readonly iAmSeller: boolean;
  readonly closed?: 'sold' | 'archived';
  readonly lastReadAt: UtcDateTime;
  readonly blocked: boolean;
  readonly reported: boolean;
  readonly messages: readonly LocalSeedMessage[];
}

export interface LocalChatRepositoryOptions {
  readonly store: KeyValueStore;
  /** Who is using this device; their messages are "mine". */
  readonly viewer: PublicProfile;
  /** The conversations a fresh install starts with. */
  readonly seed: readonly LocalSeedConversation[];
  /** The listings a conversation can be started about, and who sells each. */
  readonly findListing: (
    key: string,
  ) => { readonly listing: ChatListing; readonly seller: PublicProfile } | undefined;
  /**
   * Plays the other person, for demos: after a pause they answer each message, accept each
   * offer and confirm each pickup. Off by default; nothing here is ever sent to anyone.
   */
  readonly simulateReplies?: { readonly delayMs: number; readonly replies: readonly string[] };
  readonly storageKey?: string;
}

/** Like the database: a spot decides the place's name and pin, whatever name was sent. */
function meetupFrom(outgoing: Extract<OutgoingMessage, { kind: 'meetup' }>): ChatMeetup {
  const spot = findMeetupSpot(outgoing.spotKey);
  return {
    place: spot?.name ?? outgoing.place,
    when: outgoing.when,
    status: 'proposed',
    purpose: outgoing.purpose,
    spot: spot ? { key: spot.key, lat: spot.lat, lng: spot.lng } : undefined,
  };
}

const notFound = { kind: 'authorization', code: 'not_found_or_denied' } as const;
const conflict = (code: string) => ({ kind: 'conflict', code, retryable: false }) as const;
const nowIso = () => new Date().toISOString() as UtcDateTime;

/**
 * Chats kept on this device, for running the app before a Supabase project is configured. It
 * applies the same rules the database enforces (one conversation per buyer and listing, no
 * messages once a listing sells or someone is blocked, a new offer counters the open one, only
 * the other person answers an offer or pickup) so the app behaves the same either way.
 */
export function createLocalChatRepository(options: LocalChatRepositoryOptions): ChatRepository {
  const { store, viewer, seed, findListing, simulateReplies } = options;
  const key = options.storageKey ?? 'snapworth.chats.v1';
  const listeners = new Set<ChatListener>();
  let cache: StoredConversation[] | null = null;
  let replyCount = 0;

  function fromSeed(conversation: LocalSeedConversation): StoredConversation {
    const theirs = conversation.messages.filter((message) => !message.fromMe);
    const firstUnread = theirs[theirs.length - conversation.unread];
    const lastReadAt =
      conversation.unread > 0 && firstUnread
        ? (new Date(Date.parse(firstUnread.createdAt) - 1).toISOString() as UtcDateTime)
        : nowIso();
    return { ...conversation, lastReadAt, blocked: false, reported: false };
  }

  async function load(): Promise<StoredConversation[]> {
    if (cache) return cache;
    try {
      const raw = await store.getItem(key);
      cache = raw ? (JSON.parse(raw) as StoredConversation[]) : null;
    } catch {
      cache = null;
    }
    cache ??= seed.map(fromSeed);
    return cache;
  }

  async function save(next: StoredConversation[]): Promise<void> {
    cache = next;
    try {
      await store.setItem(key, JSON.stringify(next));
    } catch {
      // Storage full or blocked: keep working from memory for this session.
    }
  }

  async function update(
    id: string,
    change: (conversation: StoredConversation) => StoredConversation,
  ): Promise<StoredConversation | undefined> {
    const all = await load();
    let changed: StoredConversation | undefined;
    await save(
      all.map((conversation) => {
        if (conversation.id !== id) return conversation;
        changed = change(conversation);
        return changed;
      }),
    );
    return changed;
  }

  const emit = (event: ChatEvent) => listeners.forEach((listener) => listener(event));

  function toMessage(conversation: StoredConversation, message: LocalSeedMessage): Message {
    return {
      id: message.id as MessageId,
      conversationId: conversation.id as ConversationId,
      senderId: message.fromMe ? viewer.userId : conversation.other.userId,
      mine: message.fromMe,
      body: message.body,
      offer: message.offer,
      meetup: message.meetup,
      createdAt: message.createdAt,
      delivery: { status: 'delivered', deliveredAt: message.createdAt },
    };
  }

  function toSummary(conversation: StoredConversation): ConversationSummary {
    const last = conversation.messages[conversation.messages.length - 1];
    return {
      id: conversation.id as ConversationId,
      listing: conversation.listing,
      other: conversation.other,
      iAmSeller: conversation.iAmSeller,
      latest: last
        ? {
            fromMe: last.fromMe,
            body: last.body,
            offerPhp: last.offer?.amountPhp,
            meetupPlace: last.meetup?.place,
            meetupPurpose: last.meetup?.purpose,
          }
        : undefined,
      latestActivityAt: last?.createdAt ?? conversation.lastReadAt,
      unread: conversation.messages.filter(
        (message) => !message.fromMe && message.createdAt > conversation.lastReadAt,
      ).length,
      closed: conversation.closed,
      blockedByMe: conversation.blocked,
    };
  }

  /** Changes one message and tells listeners, the way Realtime reports an update. */
  async function changeMessage(
    conversationId: string,
    messageId: string,
    change: (message: LocalSeedMessage) => LocalSeedMessage,
  ) {
    const changed = await update(conversationId, (conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.id === messageId ? change(message) : message,
      ),
    }));
    const message = changed?.messages.find((entry) => entry.id === messageId);
    if (changed && message) emit({ type: 'message', message: toMessage(changed, message) });
  }

  async function append(conversationId: string, message: LocalSeedMessage) {
    const changed = await update(conversationId, (conversation) => ({
      ...conversation,
      messages: [...conversation.messages, message],
    }));
    if (changed) emit({ type: 'message', message: toMessage(changed, message) });
  }

  function answerLater(conversationId: string, sent: LocalSeedMessage) {
    if (!simulateReplies) return;
    const { delayMs, replies } = simulateReplies;
    emit({ type: 'typing', conversationId: conversationId as ConversationId, typing: true });
    setTimeout(() => {
      void (async () => {
        emit({ type: 'typing', conversationId: conversationId as ConversationId, typing: false });
        const current = (await load()).find((entry) => entry.id === conversationId);
        if (!current || current.blocked || current.closed) return;

        let body = replies[replyCount % Math.max(replies.length, 1)] ?? 'Sounds good!';
        replyCount += 1;
        if (sent.offer) {
          await changeMessage(conversationId, sent.id, (message) =>
            message.offer?.status === 'pending'
              ? { ...message, offer: { ...message.offer, status: 'accepted' } }
              : message,
          );
          body = 'Deal! When can we meet?';
        } else if (sent.meetup) {
          await changeMessage(conversationId, sent.id, (message) =>
            message.meetup
              ? { ...message, meetup: { ...message.meetup, status: 'confirmed' } }
              : message,
          );
          body = 'See you there!';
        }
        await append(conversationId, {
          id: newUuid(),
          fromMe: false,
          body,
          createdAt: nowIso(),
        });
      })();
    }, delayMs);
  }

  /** An offer or pickup from the other person in an open conversation, or why not. */
  async function answerable(messageId: string, kind: 'offer' | 'meetup') {
    const all = await load();
    for (const conversation of all) {
      const message = conversation.messages.find((entry) => entry.id === messageId);
      if (!message) continue;
      if (!message[kind]) return err(notFound);
      if (message.fromMe)
        return err({ kind: 'validation' as const, code: 'own_message', field: kind });
      if (conversation.closed) return err(conflict('conversation_closed'));
      if (conversation.blocked) return err(conflict('blocked'));
      return ok({ conversation, message });
    }
    return err(notFound);
  }

  return {
    async start(listingKey) {
      const all = await load();
      const existing = all.find(
        (conversation) => conversation.listing.key === listingKey && !conversation.iAmSeller,
      );
      if (existing) return ok(existing.id as ConversationId);

      const found = findListing(listingKey);
      if (!found) return err(notFound);
      if (found.seller.userId === viewer.userId) {
        return err({ kind: 'validation', code: 'own_listing', field: 'listing' });
      }
      const conversation: StoredConversation = {
        id: newUuid(),
        listing: found.listing,
        other: found.seller,
        iAmSeller: false,
        lastReadAt: nowIso(),
        blocked: false,
        reported: false,
        messages: [],
      };
      await save([conversation, ...all]);
      return ok(conversation.id as ConversationId);
    },

    async list() {
      const all = await load();
      return ok(
        all.map(toSummary).sort((a, b) => b.latestActivityAt.localeCompare(a.latestActivityAt)),
      );
    },

    async get(id) {
      const conversation = (await load()).find((entry) => entry.id === id);
      if (!conversation) return err(notFound);
      return ok({
        ...toSummary(conversation),
        messages: conversation.messages.map((message) => toMessage(conversation, message)),
      });
    },

    async send(id, conversationId, outgoing) {
      const conversation = (await load()).find((entry) => entry.id === conversationId);
      if (!conversation) return err(notFound);
      const earlier = conversation.messages.find((message) => message.id === id);
      if (earlier) return ok(toMessage(conversation, earlier));
      if (conversation.closed) return err(conflict('conversation_closed'));
      if (conversation.blocked) return err(conflict('blocked'));

      const message: LocalSeedMessage = {
        id,
        fromMe: true,
        body:
          outgoing.kind === 'text'
            ? outgoing.body
            : outgoing.kind === 'offer'
              ? (outgoing.note ?? '')
              : '',
        offer:
          outgoing.kind === 'offer'
            ? { amountPhp: outgoing.amountPhp, status: 'pending' }
            : undefined,
        meetup: outgoing.kind === 'meetup' ? meetupFrom(outgoing) : undefined,
        createdAt: nowIso(),
      };
      const changed = await update(conversationId, (current) => ({
        ...current,
        lastReadAt: message.createdAt,
        messages: [
          // A new offer replaces any still open on either side.
          ...current.messages.map((entry) =>
            message.offer && entry.offer?.status === 'pending'
              ? { ...entry, offer: { ...entry.offer, status: 'countered' as const } }
              : entry,
          ),
          message,
        ],
      }));
      if (!changed) return err(notFound);
      const sent = toMessage(changed, message);
      emit({ type: 'message', message: sent });
      answerLater(conversationId, message);
      return ok(sent);
    },

    async respondToOffer(messageId, accept) {
      const target = await answerable(messageId, 'offer');
      if (!target.ok) return target;
      if (target.value.message.offer?.status !== 'pending') {
        return err(conflict('offer_not_open'));
      }
      const status = accept ? 'accepted' : 'declined';
      await changeMessage(target.value.conversation.id, messageId, (message) =>
        message.offer ? { ...message, offer: { ...message.offer, status } } : message,
      );
      return ok(status);
    },

    async confirmMeetup(messageId) {
      const target = await answerable(messageId, 'meetup');
      if (!target.ok) return target;
      await changeMessage(target.value.conversation.id, messageId, (message) =>
        message.meetup
          ? { ...message, meetup: { ...message.meetup, status: 'confirmed' } }
          : message,
      );
      return ok(undefined);
    },

    async markRead(id) {
      const changed = await update(id, (conversation) => ({
        ...conversation,
        lastReadAt: nowIso(),
      }));
      return changed ? ok(undefined) : err(notFound);
    },

    async report(id) {
      const changed = await update(id, (conversation) => ({ ...conversation, reported: true }));
      return changed ? ok(undefined) : err(notFound);
    },

    async setBlocked(userId, blocked) {
      if (userId === viewer.userId) {
        return err({ kind: 'validation', code: 'self', field: 'user' });
      }
      // A block covers every conversation with that person, like the database's.
      const all = await load();
      await save(
        all.map((conversation) =>
          conversation.other.userId === userId ? { ...conversation, blocked } : conversation,
        ),
      );
      return ok(undefined);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
