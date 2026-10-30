import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useToast } from '../../components';
import type { ChatService, MeetupProposal, SendResult } from '../../ports/services';
import type { UtcDateTime } from '../../types/date-time';
import type {
  ChatMeetup,
  ChatReportReason,
  ConversationDetail,
  ConversationSummary,
  Message,
  OfferStatus,
} from '../../types/entities';
import type { AppError } from '../../types/errors';
import type { ConversationId, MessageId } from '../../types/ids';
import { findMeetupSpot } from '../../types/meetup-spots';
import { ok, type Result } from '../../types/result';
import { chatErrorCopy } from './chat-format';

export type ChatLoadStatus = 'loading' | 'ready' | 'failed';

interface ChatContextValue {
  readonly service: ChatService;
  readonly list: {
    readonly status: ChatLoadStatus;
    readonly conversations: readonly ConversationSummary[];
    readonly error: AppError | null;
  };
  /** Starts loading the list the first time something shows it. */
  readonly want: () => void;
  readonly refresh: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Supplied once by the app's composition root; views never pick their own storage. Holds the
 * conversation list, so the tab, a split view and the unread count all share one copy, kept
 * current from the service's live changes. Nothing loads until a screen asks, so browsing as a
 * guest never touches chats.
 */
export function ChatServiceProvider({
  service,
  children,
}: {
  readonly service: ChatService;
  readonly children: ReactNode;
}) {
  const [wanted, setWanted] = useState(false);
  const [list, setList] = useState<ChatContextValue['list']>({
    status: 'loading',
    conversations: [],
    error: null,
  });
  const loading = useRef<Promise<void> | null>(null);
  const again = useRef(false);

  // One load at a time; a change while one is running asks for one more after it.
  const refresh = useCallback((): Promise<void> => {
    if (loading.current) {
      again.current = true;
      return loading.current;
    }
    const run = (async () => {
      do {
        again.current = false;
        const result = await service.list();
        setList((current) =>
          result.ok
            ? { status: 'ready', conversations: result.value, error: null }
            : {
                ...current,
                status: current.status === 'ready' ? 'ready' : 'failed',
                error: result.error,
              },
        );
      } while (again.current);
      loading.current = null;
    })();
    loading.current = run;
    return run;
  }, [service]);

  useEffect(() => {
    if (!wanted) return;
    void refresh();
    return service.subscribe((event) => {
      if (event.type === 'message') void refresh();
    });
  }, [refresh, service, wanted]);

  const want = useCallback(() => setWanted(true), []);
  const value = useMemo(() => ({ service, list, want, refresh }), [list, refresh, service, want]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) throw new Error('Chat hooks need a ChatServiceProvider above them.');
  return context;
}

export interface ConversationListState {
  readonly status: ChatLoadStatus;
  readonly conversations: readonly ConversationSummary[];
  readonly error: AppError | null;
  readonly refresh: () => Promise<void>;
}

/** The viewer's conversations, newest activity first, kept current as messages arrive. */
export function useConversationList(): ConversationListState {
  const { list, want, refresh } = useChatContext();
  useEffect(want, [want]);
  return { ...list, refresh };
}

/**
 * Opens (or reopens) the viewer's conversation about a listing. Resolves to its id, or null
 * after telling the viewer why it couldn't.
 */
export function useMessageSeller(): (listingKey: string) => Promise<ConversationId | null> {
  const { service, refresh } = useChatContext();
  const toast = useToast();
  return useCallback(
    async (listingKey) => {
      const result = await service.start(listingKey);
      if (result.ok) {
        void refresh();
        return result.value;
      }
      toast.show(chatErrorCopy(result.error));
      return null;
    },
    [refresh, service, toast],
  );
}

export interface ConversationState {
  readonly status: ChatLoadStatus;
  readonly error: AppError | null;
  readonly conversation: ConversationDetail | null;
  /** Oldest first, including messages still sending or that failed to send. */
  readonly messages: readonly Message[];
  /** The other person is typing (only where the backend can tell). */
  readonly typing: boolean;
  readonly reload: () => void;
  readonly sendText: (body: string) => Promise<SendResult>;
  readonly sendOffer: (amountPhp: number, note?: string) => Promise<SendResult>;
  readonly proposeMeetup: (meetup: MeetupProposal) => Promise<SendResult>;
  /** Tries a failed message again, under the same id so it can only land once. */
  readonly retry: (messageId: MessageId) => Promise<SendResult | null>;
  readonly respondToOffer: (
    messageId: MessageId,
    accept: boolean,
  ) => Promise<Result<OfferStatus, AppError>>;
  readonly confirmMeetup: (messageId: MessageId) => Promise<Result<void, AppError>>;
  readonly report: (reason: ChatReportReason) => Promise<Result<void, AppError>>;
  readonly setBlocked: (blocked: boolean) => Promise<Result<void, AppError>>;
}

type Draft =
  | { readonly kind: 'text'; readonly body: string }
  | { readonly kind: 'offer'; readonly amountPhp: number; readonly note?: string }
  | ({ readonly kind: 'meetup' } & MeetupProposal);

/** How a proposal shows while it sends, pin and all. */
function optimisticMeetup(proposal: MeetupProposal): ChatMeetup {
  const spot = findMeetupSpot(proposal.spotKey);
  return {
    place: spot?.name ?? proposal.place ?? '',
    when: proposal.when,
    status: 'proposed',
    purpose: proposal.purpose,
    location: spot ? { lat: spot.lat, lng: spot.lng } : proposal.location,
    spotKey: spot?.key,
  };
}

/** Adds or replaces a message by id, keeping the thread oldest first. */
function upsert(messages: readonly Message[], message: Message): Message[] {
  const index = messages.findIndex((entry) => entry.id === message.id);
  if (index === -1) return [...messages, message];
  return messages.map((entry, at) => (at === index ? message : entry));
}

/** A new offer replaces any still open on either side, as the server will record it. */
const counterOpenOffers = (messages: readonly Message[]) =>
  messages.map((message) =>
    message.offer?.status === 'pending'
      ? { ...message, offer: { ...message.offer, status: 'countered' as const } }
      : message,
  );

/**
 * One conversation: loads it, marks it read, and keeps it in step with live changes. Sends
 * show straight away as "sending", then settle as delivered or failed (and can be retried);
 * answers to offers and pickups show straight away and roll back if the server refuses.
 */
export function useConversation(conversationId: string | undefined): ConversationState {
  const { service, refresh } = useChatContext();
  const [status, setStatus] = useState<ChatLoadStatus>('loading');
  const [error, setError] = useState<AppError | null>(null);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<readonly Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const drafts = useRef(new Map<MessageId, Draft>());
  const id = conversationId as ConversationId | undefined;

  useEffect(() => {
    if (!id) return;
    let active = true;
    setStatus('loading');
    void service.get(id).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setError(result.error);
        setStatus('failed');
        return;
      }
      setConversation(result.value);
      setMessages(result.value.messages);
      setError(null);
      setStatus('ready');
      if (result.value.unread > 0) void service.markRead(id).then(() => refresh());
    });
    const unsubscribe = service.subscribe((event) => {
      if (!active) return;
      if (event.type === 'typing') {
        if (event.conversationId === id) setTyping(event.typing);
        return;
      }
      if (event.message.conversationId !== id) return;
      setMessages((current) => {
        const next = upsert(current, event.message);
        // An offer from the other person counters ours, here as on the server.
        return event.message.offer?.status === 'pending'
          ? next.map((message) =>
              message.id !== event.message.id && message.offer?.status === 'pending'
                ? { ...message, offer: { ...message.offer, status: 'countered' as const } }
                : message,
            )
          : next;
      });
      if (!event.message.mine) {
        setTyping(false);
        void service.markRead(id).then(() => refresh());
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [attempt, id, refresh, service]);

  const deliver = useCallback(
    async (messageId: MessageId, draft: Draft): Promise<SendResult> => {
      if (!id) return { ok: false, error: { kind: 'authorization', code: 'not_found_or_denied' } };
      drafts.current.set(messageId, draft);
      const now = new Date().toISOString() as UtcDateTime;
      const optimistic: Message = {
        id: messageId,
        conversationId: id,
        // The server fills in the sender; `mine` is all the thread needs meanwhile.
        senderId: '' as Message['senderId'],
        mine: true,
        body:
          draft.kind === 'text'
            ? draft.body.trim()
            : draft.kind === 'offer'
              ? (draft.note ?? '')
              : '',
        offer:
          draft.kind === 'offer' ? { amountPhp: draft.amountPhp, status: 'pending' } : undefined,
        meetup: draft.kind === 'meetup' ? optimisticMeetup(draft) : undefined,
        createdAt: now,
        delivery: { status: 'pending' },
      };
      setMessages((current) =>
        upsert(draft.kind === 'offer' ? counterOpenOffers(current) : current, optimistic),
      );

      const result =
        draft.kind === 'text'
          ? await service.sendText(messageId, id, draft.body)
          : draft.kind === 'offer'
            ? await service.sendOffer(messageId, id, draft.amountPhp, draft.note)
            : await service.proposeMeetup(messageId, id, draft);

      if (result.ok) {
        drafts.current.delete(messageId);
        setMessages((current) => upsert(current, result.value));
      } else {
        const retryable = 'retryable' in result.error && result.error.retryable;
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? { ...message, delivery: { status: 'failed', error: result.error, retryable } }
              : message,
          ),
        );
      }
      return result;
    },
    [id, service],
  );

  const sendText = useCallback(
    (body: string) => deliver(service.nextMessageId(), { kind: 'text', body }),
    [deliver, service],
  );
  const sendOffer = useCallback(
    (amountPhp: number, note?: string) =>
      deliver(service.nextMessageId(), { kind: 'offer', amountPhp, note }),
    [deliver, service],
  );
  const proposeMeetup = useCallback(
    (meetup: MeetupProposal) => deliver(service.nextMessageId(), { kind: 'meetup', ...meetup }),
    [deliver, service],
  );
  const retry = useCallback(
    async (messageId: MessageId) => {
      const draft = drafts.current.get(messageId);
      return draft ? deliver(messageId, draft) : null;
    },
    [deliver],
  );

  /** Shows an answer straight away and puts the message back if the server refuses it. */
  const answer = useCallback(
    async <T,>(
      messageId: MessageId,
      change: (message: Message) => Message,
      call: () => Promise<Result<T, AppError>>,
    ): Promise<Result<T, AppError>> => {
      const before = messages.find((message) => message.id === messageId);
      setMessages((current) =>
        current.map((message) => (message.id === messageId ? change(message) : message)),
      );
      const result = await call();
      if (!result.ok && before) setMessages((current) => upsert(current, before));
      return result;
    },
    [messages],
  );

  const respondToOffer = useCallback(
    (messageId: MessageId, accept: boolean) =>
      answer(
        messageId,
        (message) =>
          message.offer
            ? { ...message, offer: { ...message.offer, status: accept ? 'accepted' : 'declined' } }
            : message,
        () => service.respondToOffer(messageId, accept),
      ),
    [answer, service],
  );

  const confirmMeetup = useCallback(
    (messageId: MessageId) =>
      answer(
        messageId,
        (message) =>
          message.meetup
            ? { ...message, meetup: { ...message.meetup, status: 'confirmed' } }
            : message,
        () => service.confirmMeetup(messageId),
      ),
    [answer, service],
  );

  const report = useCallback(
    (reason: ChatReportReason) =>
      id ? service.report(id, reason) : Promise.resolve(ok(undefined)),
    [id, service],
  );

  const setBlocked = useCallback(
    async (blocked: boolean) => {
      if (!conversation) return ok(undefined);
      const result = await service.setBlocked(conversation.other.userId, blocked);
      if (result.ok) {
        setConversation((current) => (current ? { ...current, blockedByMe: blocked } : current));
        void refresh();
      }
      return result;
    },
    [conversation, refresh, service],
  );

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  return {
    status: id ? status : 'failed',
    error: id ? error : { kind: 'authorization', code: 'not_found_or_denied' },
    conversation,
    messages,
    typing,
    reload,
    sendText,
    sendOffer,
    proposeMeetup,
    retry,
    respondToOffer,
    confirmMeetup,
    report,
    setBlocked,
  };
}
