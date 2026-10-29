import type { ChatRepository } from '../ports/chat';
import type { ChatService, SendResult } from '../ports/services';
import { parseMessageBody } from '../types/entities';
import { newUuid, type MessageId } from '../types/ids';
import { findMeetupSpot } from '../types/meetup-spots';
import { err } from '../types/result';

/** The largest offer the database accepts, in pesos. */
export const maximumOfferPhp = 100_000_000;
const meetupPlaceMaxLength = 120;
const meetupWhenMaxLength = 80;

/**
 * Chats on top of any storage: each message is validated before it is stored, under an id
 * picked here so a retry after a dropped connection lands once. Who may see or answer what is
 * left to the repository, which in Supabase is row-level security.
 */
export function createChatService(repository: ChatRepository): ChatService {
  return {
    start: (listingKey) => repository.start(listingKey),
    list: () => repository.list(),
    get: (id) => repository.get(id),
    nextMessageId: () => newUuid() as MessageId,

    async sendText(id, conversationId, raw): Promise<SendResult> {
      const body = parseMessageBody(raw);
      if (!body.ok) return err(body.error);
      return repository.send(id, conversationId, { kind: 'text', body: body.value });
    },

    async sendOffer(id, conversationId, amountPhp, rawNote): Promise<SendResult> {
      if (!Number.isInteger(amountPhp) || amountPhp < 1 || amountPhp > maximumOfferPhp) {
        return err({ kind: 'validation', code: 'out_of_range', field: 'offer' });
      }
      let note;
      if (rawNote?.trim()) {
        const parsed = parseMessageBody(rawNote);
        if (!parsed.ok) return err(parsed.error);
        note = parsed.value;
      }
      return repository.send(id, conversationId, { kind: 'offer', amountPhp, note });
    },

    async proposeMeetup(id, conversationId, meetup): Promise<SendResult> {
      const spot = findMeetupSpot(meetup.spotKey);
      if (meetup.spotKey && !spot) {
        return err({ kind: 'validation', code: 'unknown_spot', field: 'place' });
      }
      const place = spot?.name ?? meetup.place?.trim() ?? '';
      const when = meetup.when.trim();
      if (!place || place.length > meetupPlaceMaxLength) {
        return err({ kind: 'validation', code: place ? 'too_long' : 'empty', field: 'place' });
      }
      if (!when || when.length > meetupWhenMaxLength) {
        return err({ kind: 'validation', code: when ? 'too_long' : 'empty', field: 'when' });
      }
      return repository.send(id, conversationId, {
        kind: 'meetup',
        purpose: meetup.purpose,
        spotKey: spot?.key,
        place,
        when,
      });
    },

    respondToOffer: (messageId, accept) => repository.respondToOffer(messageId, accept),
    confirmMeetup: (messageId) => repository.confirmMeetup(messageId),
    markRead: (id) => repository.markRead(id),
    report: (id, reason) => repository.report(id, reason),
    setBlocked: (userId, blocked) => repository.setBlocked(userId, blocked),
    subscribe: (listener) => repository.subscribe(listener),
  };
}
