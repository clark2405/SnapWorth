import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import type { ChatListener, ChatRepository } from '../../ports/chat';
import type { UtcDateTime } from '../../types/date-time';
import type {
  ConversationSummary,
  MeetupPurpose,
  MeetupStatus,
  Message,
  OfferStatus,
} from '../../types/entities';
import type { AppError, OperationName } from '../../types/errors';
import type { ConversationId, MessageId, UserId } from '../../types/ids';
import { err, ok, type Result } from '../../types/result';
import { toAppError } from './errors';
import { ensureSignedIn } from './session';

interface MessageRow {
  readonly id: string;
  readonly conversation_id: string;
  readonly sender_id: string;
  readonly kind: 'text' | 'offer' | 'meetup';
  readonly body: string;
  readonly offer_php: number | null;
  readonly offer_status: OfferStatus | null;
  readonly meetup_place: string | null;
  readonly meetup_when: string | null;
  readonly meetup_status: MeetupStatus | null;
  readonly meetup_purpose: MeetupPurpose | null;
  readonly meetup_spot: string | null;
  readonly meetup_lat: number | null;
  readonly meetup_lng: number | null;
  readonly created_at: string;
}

interface ConversationRow {
  readonly id: string;
  readonly listing_slug: string;
  readonly listing_title: string;
  readonly listing_photo_url: string | null;
  readonly asking_php: number;
  readonly closed: 'sold' | 'archived' | null;
  readonly other_id: string;
  readonly other_handle: string;
  readonly other_avatar_url: string | null;
  readonly i_am_seller: boolean;
  readonly last_kind: MessageRow['kind'] | null;
  readonly last_body: string | null;
  readonly last_offer_php: number | null;
  readonly last_meetup_place: string | null;
  readonly last_meetup_purpose: MeetupPurpose | null;
  readonly last_from_me: boolean | null;
  readonly last_message_at: string;
  readonly unread_count: number;
  readonly blocked_by_me: boolean;
}

const messageColumns =
  'id, conversation_id, sender_id, kind, body, offer_php, offer_status, meetup_place, meetup_when, meetup_status, meetup_purpose, meetup_spot, meetup_lat, meetup_lng, created_at';

const iso = (value: string) => new Date(value).toISOString() as UtcDateTime;

function messageFromRow(row: MessageRow, viewer: string): Message {
  const createdAt = iso(row.created_at);
  return {
    id: row.id as MessageId,
    conversationId: row.conversation_id as ConversationId,
    senderId: row.sender_id as UserId,
    mine: row.sender_id === viewer,
    body: row.body,
    offer:
      row.kind === 'offer' && row.offer_php !== null && row.offer_status
        ? { amountPhp: row.offer_php, status: row.offer_status }
        : undefined,
    meetup:
      row.kind === 'meetup' && row.meetup_place && row.meetup_when && row.meetup_status
        ? {
            place: row.meetup_place,
            when: row.meetup_when,
            status: row.meetup_status,
            purpose: row.meetup_purpose ?? 'pickup',
            location:
              row.meetup_lat !== null && row.meetup_lng !== null
                ? { lat: row.meetup_lat, lng: row.meetup_lng }
                : undefined,
            spotKey: row.meetup_spot ?? undefined,
          }
        : undefined,
    createdAt,
    delivery: { status: 'delivered', deliveredAt: createdAt },
  };
}

function summaryFromRow(row: ConversationRow): ConversationSummary {
  return {
    id: row.id as ConversationId,
    listing: {
      key: row.listing_slug,
      title: row.listing_title,
      askingPricePhp: row.asking_php,
      photoUrl: row.listing_photo_url ?? undefined,
    },
    other: {
      userId: row.other_id as UserId,
      handle: row.other_handle,
      avatarUrl: row.other_avatar_url ?? undefined,
    },
    iAmSeller: row.i_am_seller,
    latest:
      row.last_kind === null
        ? undefined
        : {
            fromMe: row.last_from_me === true,
            body: row.last_body ?? '',
            offerPhp: row.last_offer_php ?? undefined,
            meetupPlace: row.last_meetup_place ?? undefined,
            meetupPurpose: row.last_meetup_purpose ?? undefined,
          },
    latestActivityAt: iso(row.last_message_at),
    unread: row.unread_count,
    closed: row.closed ?? undefined,
    blockedByMe: row.blocked_by_me,
  };
}

/**
 * Chats stored in Supabase, with new messages and answers streamed over Realtime. Who may see
 * or do what is decided by the database's row-level security and functions; this adapter only
 * translates. Until email sign-in is wired up, a device without a session signs in
 * anonymously, the same way comments do.
 */
export function createSupabaseChatRepository(client: SupabaseClient): ChatRepository {
  const viewerId = () => ensureSignedIn(client);

  async function conversationRows(
    target: string | null,
    operation: OperationName,
  ): Promise<Result<ConversationRow[], AppError>> {
    const viewer = await viewerId();
    if (!viewer.ok) return viewer;
    const { data, error } = await client.rpc('conversation_list', { target });
    if (error) return err(toAppError(error, operation));
    return ok(data as ConversationRow[]);
  }

  // One Realtime channel per device, shared by every screen that listens: supabase-js keeps one
  // channel per name, and a joined channel takes no new listeners.
  const listeners = new Set<ChatListener>();
  let channel: RealtimeChannel | undefined;
  let opening = 0;

  function openChannel() {
    const attempt = ++opening;
    void viewerId().then((viewer) => {
      if (attempt !== opening || listeners.size === 0 || !viewer.ok) return;
      // Row-level security decides which changes reach this device: only its conversations.
      channel = client
        .channel(`chats:${viewer.value}`)
        .on<MessageRow>(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages' },
          (change) => {
            if (change.eventType === 'DELETE') return;
            const event = {
              type: 'message' as const,
              message: messageFromRow(change.new, viewer.value),
            };
            listeners.forEach((each) => each(event));
          },
        )
        .subscribe();
    });
  }

  function closeChannel() {
    opening += 1;
    if (channel) void client.removeChannel(channel);
    channel = undefined;
  }

  return {
    async start(listingKey) {
      const viewer = await viewerId();
      if (!viewer.ok) return viewer;
      const { data, error } = await client.rpc('start_conversation', { listing_slug: listingKey });
      if (error) return err(toAppError(error, 'open_conversation'));
      return ok(data as ConversationId);
    },

    async list() {
      const rows = await conversationRows(null, 'load_conversations');
      return rows.ok ? ok(rows.value.map(summaryFromRow)) : rows;
    },

    async get(id) {
      const rows = await conversationRows(id, 'load_messages');
      if (!rows.ok) return rows;
      const row = rows.value[0];
      if (!row) return err({ kind: 'authorization', code: 'not_found_or_denied' });

      const viewer = await viewerId();
      if (!viewer.ok) return viewer;
      const { data, error } = await client
        .from('messages')
        .select(messageColumns)
        .eq('conversation_id', id)
        .order('seq', { ascending: true })
        .limit(500);
      if (error) return err(toAppError(error, 'load_messages'));
      return ok({
        ...summaryFromRow(row),
        messages: (data as MessageRow[]).map((message) => messageFromRow(message, viewer.value)),
      });
    },

    async send(id, conversationId, message) {
      const viewer = await viewerId();
      if (!viewer.ok) return viewer;
      const { data, error } = await client
        .from('messages')
        .insert({
          id,
          conversation_id: conversationId,
          kind: message.kind,
          body:
            message.kind === 'text'
              ? message.body
              : message.kind === 'offer'
                ? (message.note ?? '')
                : '',
          offer_php: message.kind === 'offer' ? message.amountPhp : null,
          meetup_place: message.kind === 'meetup' ? message.place : null,
          meetup_when: message.kind === 'meetup' ? message.when : null,
          meetup_purpose: message.kind === 'meetup' ? message.purpose : null,
          meetup_spot: message.kind === 'meetup' ? (message.spotKey ?? null) : null,
          // A suggested spot's pin is filled in by the database; any other pin is sent as is.
          meetup_lat:
            message.kind === 'meetup' && !message.spotKey ? (message.location?.lat ?? null) : null,
          meetup_lng:
            message.kind === 'meetup' && !message.spotKey ? (message.location?.lng ?? null) : null,
        })
        .select(messageColumns)
        .single();
      if (!error) return ok(messageFromRow(data as MessageRow, viewer.value));

      // A resend after a dropped connection: the first attempt landed, so return it.
      if (error.code === '23505') {
        const earlier = await client.from('messages').select(messageColumns).eq('id', id).single();
        if (!earlier.error) return ok(messageFromRow(earlier.data as MessageRow, viewer.value));
      }
      return err(toAppError(error, 'send_message', 'message'));
    },

    async respondToOffer(messageId, accept) {
      const { data, error } = await client.rpc('respond_to_offer', { target: messageId, accept });
      if (error) return err(toAppError(error, 'send_message'));
      return ok(data as OfferStatus);
    },

    async confirmMeetup(messageId) {
      const { error } = await client.rpc('confirm_meetup', { target: messageId });
      return error ? err(toAppError(error, 'send_message')) : ok(undefined);
    },

    async markRead(id) {
      const { error } = await client.rpc('mark_conversation_read', { target: id });
      return error ? err(toAppError(error, 'load_messages')) : ok(undefined);
    },

    async report(id, reason) {
      const { error } = await client
        .from('conversation_reports')
        .insert({ conversation_id: id, reason });
      // Reporting twice is not a failure from the reporter's point of view.
      if (!error || error.code === '23505') return ok(undefined);
      return err(toAppError(error, 'report_content'));
    },

    async setBlocked(userId, blocked) {
      const { error } = await client.rpc('set_block', { target: userId, blocked });
      return error ? err(toAppError(error, 'block_user')) : ok(undefined);
    },

    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) openChannel();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) closeChannel();
      };
    },
  };
}
