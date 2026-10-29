import {
  createLocalChatRepository,
  type KeyValueStore,
  type LocalSeedConversation,
} from '../adapters';
import type { ChatEvent } from '../ports/chat';
import { createChatService } from '../services';
import type { UtcDateTime } from '../types/date-time';
import type { ChatListing, PublicProfile } from '../types/entities';
import type { ConversationId, MessageId, UserId } from '../types/ids';

const person = (handle: string): PublicProfile => ({
  userId: `test:${handle}` as UserId,
  handle,
});
const viewer = person('me');
const seller = person('sam');

const lamp: ChatListing = { key: 'lamp', title: 'Brass lamp', askingPricePhp: 1500 };
const radio: ChatListing = { key: 'radio', title: 'Radio', askingPricePhp: 900 };

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => Promise.resolve(data.get(key) ?? null),
    setItem: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

const at = (minute: number) =>
  new Date(Date.UTC(2026, 9, 1, 10, minute)).toISOString() as UtcDateTime;

const seed: LocalSeedConversation[] = [
  {
    id: 'sold-radio',
    listing: radio,
    other: seller,
    iAmSeller: false,
    closed: 'sold',
    unread: 0,
    messages: [{ id: 'r1', fromMe: false, body: 'Sold, thanks!', createdAt: at(1) }],
  },
  {
    id: 'buyer-asks',
    listing: { key: 'mine', title: 'My jacket', askingPricePhp: 2000 },
    other: person('bea'),
    iAmSeller: true,
    unread: 2,
    messages: [
      { id: 'b1', fromMe: false, body: 'Hi!', createdAt: at(2) },
      { id: 'b2', fromMe: false, body: 'Still available?', createdAt: at(3) },
      {
        id: 'b3',
        fromMe: false,
        body: '',
        offer: { amountPhp: 1800, status: 'pending' },
        createdAt: at(4),
      },
    ],
  },
];

function setup(simulate = false) {
  const repository = createLocalChatRepository({
    store: memoryStore(),
    viewer,
    seed,
    findListing: (key) => (key === 'lamp' ? { listing: lamp, seller } : undefined),
    simulateReplies: simulate ? { delayMs: 10, replies: ['Sure!'] } : undefined,
  });
  return createChatService(repository);
}

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.error)}`);
  return result.value;
}

describe('starting a conversation', () => {
  it('opens one conversation per listing and reopens it after', async () => {
    const chat = setup();
    const first = unwrap(await chat.start('lamp'));
    expect(unwrap(await chat.start('lamp'))).toBe(first);
    const detail = unwrap(await chat.get(first));
    expect(detail).toMatchObject({ listing: lamp, other: seller, iAmSeller: false, messages: [] });
  });

  it('refuses a listing that does not exist', async () => {
    const result = await setup().start('nothing');
    expect(result.ok || result.error.kind).toBe('authorization');
  });
});

describe('sending', () => {
  it('trims a message, stores it once under its id, and lists it newest first', async () => {
    const chat = setup();
    const id = unwrap(await chat.start('lamp'));
    const messageId = chat.nextMessageId();
    const sent = unwrap(await chat.sendText(messageId, id, '  Is it still available?  '));
    expect(sent).toMatchObject({ body: 'Is it still available?', mine: true });
    unwrap(await chat.sendText(messageId, id, 'Is it still available?'));

    expect(unwrap(await chat.get(id)).messages).toHaveLength(1);
    const [newest] = unwrap(await chat.list());
    expect(newest).toMatchObject({ id, latest: { fromMe: true, body: 'Is it still available?' } });
  });

  it('rejects empty messages and impossible offers before storing anything', async () => {
    const chat = setup();
    const id = unwrap(await chat.start('lamp'));
    const empty = await chat.sendText(chat.nextMessageId(), id, '   ');
    const negative = await chat.sendOffer(chat.nextMessageId(), id, -5);
    const fractional = await chat.sendOffer(chat.nextMessageId(), id, 10.5);
    expect([empty, negative, fractional].map((result) => !result.ok && result.error.kind)).toEqual([
      'validation',
      'validation',
      'validation',
    ]);
    expect(unwrap(await chat.get(id)).messages).toHaveLength(0);
  });

  it('refuses messages once the listing has sold', async () => {
    const chat = setup();
    const result = await chat.sendText(
      chat.nextMessageId(),
      'sold-radio' as ConversationId,
      'Any chance?',
    );
    expect(!result.ok && result.error).toMatchObject({
      kind: 'conflict',
      code: 'conversation_closed',
    });
  });
});

describe('offers and reads', () => {
  const conversation = 'buyer-asks' as ConversationId;

  it('counts unread messages from the other person until the conversation is read', async () => {
    const chat = setup();
    const before = unwrap(await chat.list()).find((entry) => entry.id === conversation);
    expect(before?.unread).toBe(2);
    unwrap(await chat.markRead(conversation));
    const after = unwrap(await chat.list()).find((entry) => entry.id === conversation);
    expect(after?.unread).toBe(0);
  });

  it('a counter-offer replaces the open one, which can then no longer be accepted', async () => {
    const chat = setup();
    unwrap(await chat.sendOffer(chat.nextMessageId(), conversation, 1900, 'Meet me halfway?'));
    const messages = unwrap(await chat.get(conversation)).messages;
    expect(messages.map((message) => message.offer?.status)).toEqual([
      undefined,
      undefined,
      'countered',
      'pending',
    ]);
    expect(messages[3]?.body).toBe('Meet me halfway?');
    const late = await chat.respondToOffer('b3' as MessageId, true);
    expect(!late.ok && late.error).toMatchObject({ kind: 'conflict', code: 'offer_not_open' });
  });

  it('only the other person can answer an offer', async () => {
    const chat = setup();
    const own = chat.nextMessageId();
    unwrap(await chat.sendOffer(own, conversation, 1950));
    const result = await chat.respondToOffer(own, true);
    expect(!result.ok && result.error.kind).toBe('validation');
  });

  it('accepting an open offer records it', async () => {
    const chat = setup();
    expect(unwrap(await chat.respondToOffer('b3' as MessageId, true))).toBe('accepted');
    const offer = unwrap(await chat.get(conversation)).messages[2]?.offer;
    expect(offer?.status).toBe('accepted');
  });
});

describe('meeting up', () => {
  it('pins a pickup to a public spot, taking its name and pin from the spot', async () => {
    const chat = setup();
    const id = unwrap(await chat.start('lamp'));
    const sent = unwrap(
      await chat.proposeMeetup(chat.nextMessageId(), id, {
        purpose: 'viewing',
        spotKey: 'megamall',
        place: 'My place, 42 Quiet Street',
        when: 'Saturday, 2:00 PM',
      }),
    );
    expect(sent.meetup).toEqual({
      place: 'SM Megamall',
      when: 'Saturday, 2:00 PM',
      status: 'proposed',
      purpose: 'viewing',
      spot: { key: 'megamall', lat: 14.5849, lng: 121.0566 },
    });
    const [row] = unwrap(await chat.list());
    expect(row?.latest).toMatchObject({ meetupPlace: 'SM Megamall', meetupPurpose: 'viewing' });
  });

  it('refuses a spot that is not on the list', async () => {
    const chat = setup();
    const id = unwrap(await chat.start('lamp'));
    const result = await chat.proposeMeetup(chat.nextMessageId(), id, {
      purpose: 'pickup',
      spotKey: 'my-house',
      when: 'Today, 6:00 PM',
    });
    expect(!result.ok && result.error).toMatchObject({ kind: 'validation', code: 'unknown_spot' });
    expect(unwrap(await chat.get(id)).messages).toHaveLength(0);
  });
});

describe('blocking', () => {
  it('stops messages both ways in every conversation with that person', async () => {
    const chat = setup();
    const id = unwrap(await chat.start('lamp'));
    unwrap(await chat.setBlocked(seller.userId, true));
    expect(unwrap(await chat.get(id)).blockedByMe).toBe(true);
    const result = await chat.sendText(chat.nextMessageId(), id, 'hello?');
    expect(!result.ok && result.error).toMatchObject({ kind: 'conflict', code: 'blocked' });

    unwrap(await chat.setBlocked(seller.userId, false));
    expect((await chat.sendText(chat.nextMessageId(), id, 'Sorry!')).ok).toBe(true);
  });
});

describe('the demo other side', () => {
  it('types, accepts an offer, and answers, all as live events', async () => {
    const chat = setup(true);
    const id = unwrap(await chat.start('lamp'));
    const events: ChatEvent[] = [];
    const stop = chat.subscribe((event) => events.push(event));
    const offerId = chat.nextMessageId();
    unwrap(await chat.sendOffer(offerId, id, 1400));
    await new Promise((resolve) => setTimeout(resolve, 50));
    stop();

    const offer = unwrap(await chat.get(id)).messages.find((message) => message.id === offerId);
    expect(offer?.offer?.status).toBe('accepted');
    expect(events.map((event) => event.type)).toEqual([
      'message',
      'typing',
      'typing',
      'message',
      'message',
    ]);
    const last = unwrap(await chat.get(id)).messages.at(-1);
    expect(last).toMatchObject({ mine: false, body: 'Deal! When can we meet?' });
  });
});
