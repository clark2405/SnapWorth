import type { ConversationPreview } from '../../types/entities';
import type { AppError } from '../../types/errors';
import { formatPeso } from '../preview/peso';

const timeFormatter = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' });
const weekdayFormatter = new Intl.DateTimeFormat('en-PH', { weekday: 'short' });
const dateFormatter = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' });

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** When a message was sent, as a thread shows it: just the time of day. */
export function formatMessageTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

/**
 * When a conversation last moved, as the list shows it: the time today, "Yesterday", the
 * weekday within the week, then the date.
 */
export function formatListTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return timeFormatter.format(date);
  if (days === 1) return 'Yesterday';
  if (days < 7) return weekdayFormatter.format(date);
  return dateFormatter.format(date);
}

/** The latest message in one line: an offer and a pickup say what they are. */
export function describeLatest(latest: ConversationPreview | undefined): string {
  if (!latest) return 'No messages yet';
  if (latest.offerPhp !== undefined) {
    const offer = `Offered ${formatPeso(latest.offerPhp)}`;
    return latest.body ? `${offer} · ${latest.body}` : offer;
  }
  if (latest.meetupPlace) {
    return `${latest.meetupPurpose === 'viewing' ? 'Viewing' : 'Pickup'} at ${latest.meetupPlace}`;
  }
  return latest.body;
}

/** What to tell someone when a chat action didn't go through. */
export function chatErrorCopy(error: AppError): { readonly title: string; readonly body?: string } {
  switch (error.kind) {
    case 'offline':
    case 'timeout':
      return { title: 'Not sent', body: "You're offline. Tap the message to try again." };
    case 'rate_limited':
      return { title: 'Slow down a little', body: 'Try again in a minute.' };
    case 'conflict':
      if (error.code === 'conversation_closed') {
        return { title: 'This conversation is closed', body: 'The item has sold.' };
      }
      if (error.code === 'blocked') return { title: "You can't message this person" };
      if (error.code === 'offer_not_open') {
        return { title: 'That offer is no longer open', body: 'A newer offer replaced it.' };
      }
      return { title: 'Something changed', body: 'Pull to refresh and try again.' };
    case 'validation':
      if (error.code === 'own_listing') return { title: 'This is your own listing' };
      if (error.code === 'too_long') {
        return {
          title: 'Too long',
          body: `Keep it under ${error.limit ?? 'the limit'} characters.`,
        };
      }
      return { title: "That can't be sent" };
    case 'authorization':
      return { title: 'This conversation is no longer available' };
    default:
      return { title: 'Something went wrong', body: 'Try again in a moment.' };
  }
}
