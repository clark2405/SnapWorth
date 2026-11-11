import { Handshake, MapPin, MessageCircle, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef } from 'react';

import { useBanner } from '../../components';
import type { ConversationSummary, Message } from '../../types/entities';
import type { NotificationKey } from '../profile/NotificationsView';
import { formatPeso } from '../preview/peso';
import { useSession } from '../session';
import { useChatLive } from './chat-state';

/** What a banner says about a message, and which kind of notification it counts as. */
export interface ChatBannerContent {
  readonly title: string;
  readonly body: string;
  readonly icon: LucideIcon;
  readonly kind: Extract<NotificationKey, 'messages' | 'offers'>;
}

const snippetLength = 140;

const snippet = (text: string) =>
  text.length > snippetLength ? `${text.slice(0, snippetLength - 1).trimEnd()}…` : text;

/**
 * The banner for a message that just arrived, or null when it needs none: the viewer's own
 * messages, and an offer or pickup being answered rather than made (those arrive again, whole,
 * with their new status). Offers and pickups lead with what they are.
 */
export function chatBannerFor(
  message: Message,
  conversation: Pick<ConversationSummary, 'listing' | 'other'> | undefined,
): ChatBannerContent | null {
  if (message.mine) return null;
  const title = conversation ? `@${conversation.other.handle}` : 'New message';
  const about = conversation ? ` on ${conversation.listing.title}` : '';

  if (message.offer) {
    if (message.offer.status !== 'pending') return null;
    const offer = `Offered ${formatPeso(message.offer.amountPhp)}${about}`;
    return {
      title,
      body: message.body ? `${offer} · ${snippet(message.body)}` : offer,
      icon: Handshake,
      kind: 'offers',
    };
  }
  if (message.meetup) {
    if (message.meetup.status !== 'proposed') return null;
    const { place, when, purpose } = message.meetup;
    const what = purpose === 'viewing' ? 'viewing' : 'pickup';
    return {
      title,
      body: `Proposed a ${what} at ${place}, ${when}`,
      icon: MapPin,
      kind: 'messages',
    };
  }
  if (!message.body) return null;
  return { title, body: snippet(message.body), icon: MessageCircle, kind: 'messages' };
}

/** How many message ids the host remembers, so one that arrives twice shows once. */
const rememberedIds = 200;

export interface ChatBannerHostProps {
  /** Opens a conversation: the app shell owns navigation. */
  readonly onOpenConversation: (conversationId: string) => void;
  /** Whether the person wants to hear about this kind of thing; the shell reads their choices. */
  readonly wants?: (kind: ChatBannerContent['kind']) => boolean | Promise<boolean>;
}

/**
 * While the app is open, shows a tappable banner when someone writes, makes an offer or proposes
 * a meetup in a chat the viewer isn't looking at. It listens to the same live changes the chat
 * list does, so it works wherever the chat service does; renders nothing itself. When the
 * account changes, banners and what was already shown are dropped with the old account's chats.
 */
export function ChatBannerHost({ onOpenConversation, wants }: ChatBannerHostProps) {
  const { service, conversations, viewing, want } = useChatLive();
  const { status } = useSession();
  const banner = useBanner();
  const signedIn = status === 'member';

  // The latest of these, read when a change arrives rather than when the host renders.
  const known = useRef(conversations);
  known.current = conversations;
  const open = useRef(onOpenConversation);
  open.current = onOpenConversation;
  const wanted = useRef(wants);
  wanted.current = wants;

  useEffect(() => {
    if (signedIn) want();
  }, [signedIn, want]);

  useEffect(() => {
    if (!signedIn) {
      banner.dismiss();
      return;
    }
    const shown: string[] = [];
    /** Moves on with the account, so a banner still being worked out for the old one is dropped. */
    let epoch = 0;

    const unsubscribe = service.subscribe((event) => {
      if (event.type === 'account') {
        epoch += 1;
        shown.length = 0;
        banner.dismiss();
        return;
      }
      if (event.type !== 'message') return;
      const { message } = event;
      if (message.mine || shown.includes(message.id)) return;
      if ((viewing.current.get(message.conversationId) ?? 0) > 0) return;
      const content = chatBannerFor(message, undefined);
      if (!content) return;
      // Remembered at once: the same message arriving again while this is worked out is the same.
      shown.push(message.id);
      if (shown.length > rememberedIds) shown.shift();

      const mine = epoch;
      void (async () => {
        let conversation = known.current.find((entry) => entry.id === message.conversationId);
        if (!conversation) {
          // A chat that has only just begun isn't in the list yet.
          const loaded = await service.list();
          conversation = loaded.ok
            ? loaded.value.find((entry) => entry.id === message.conversationId)
            : undefined;
        }
        if (epoch !== mine) return;
        if (conversation?.blockedByMe || conversation?.closed) return;
        // They may have opened the chat while this was worked out.
        if ((viewing.current.get(message.conversationId) ?? 0) > 0) return;
        const filled = chatBannerFor(message, conversation);
        if (!filled) return;
        const allowed = (await wanted.current?.(filled.kind)) ?? true;
        if (!allowed || epoch !== mine) return;
        banner.show({
          id: message.id,
          title: filled.title,
          body: filled.body,
          icon: filled.icon,
          onPress: () => open.current(message.conversationId),
        });
      })();
    });
    return () => {
      epoch += 1;
      unsubscribe();
    };
  }, [banner, service, signedIn, viewing]);

  return null;
}
