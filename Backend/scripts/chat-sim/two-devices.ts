// Two phones chatting through the backend, plus a third that tries to get in. Each "device" is
// its own Supabase client with its own session, running the app's real chat adapter and service
// (Frontend/shared). Run by run.sh against start.sh's local backend.
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, PG_HOST, PG_PORT, PG_BIN.

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";

import { createSupabaseChatRepository } from "../../../Frontend/shared/src/adapters/supabase/chat-repository";
import { createSupabaseClient } from "../../../Frontend/shared/src/adapters/supabase/client";
import type { ChatEvent } from "../../../Frontend/shared/src/ports/chat";
import { createChatService } from "../../../Frontend/shared/src/services/chat-service";
import type {
  ConversationId,
  UserId,
} from "../../../Frontend/shared/src/types/ids";

const url = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;

let failures = 0;
function check(passed: boolean, description: string, detail?: unknown) {
  if (passed) console.log(`  ok   ${description}`);
  else {
    failures += 1;
    console.log(
      `  FAIL ${description}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`,
    );
  }
}
const section = (title: string) => console.log(`\n${title}`);

async function waitFor<T>(
  find: () => T | undefined,
  ms = 4000,
): Promise<T | undefined> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const found = find();
    if (found !== undefined) return found;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return undefined;
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One phone: its own client and session, the app's chat service, and what it heard live. */
function device(name: string) {
  const client = createSupabaseClient({ url, anonKey });
  const chat = createChatService(createSupabaseChatRepository(client));
  const heard: ChatEvent[] = [];
  return {
    name,
    client,
    chat,
    heard,
    listen: () => chat.subscribe((event) => heard.push(event)),
    async session() {
      const { data } = await client.auth.getSession();
      return data.session!;
    },
    heardMessage: (
      predicate: (event: Extract<ChatEvent, { type: "message" }>) => boolean,
    ) =>
      waitFor(() =>
        heard.find(
          (event): event is Extract<ChatEvent, { type: "message" }> =>
            event.type === "message" && predicate(event),
        ),
      ),
  };
}

function asSuperuser(sql: string) {
  return execFileSync(
    path.join(process.env.PG_BIN!, "psql"),
    [
      "-X",
      "-q",
      "-At",
      "-h",
      process.env.PG_HOST!,
      "-p",
      process.env.PG_PORT!,
      "-U",
      "postgres",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  ).trim();
}

/** A raw request to the data API, the way an attacker with a token would send it. */
async function raw(
  method: string,
  route: string,
  token: string,
  body?: unknown,
) {
  const response = await fetch(`${url}/rest/v1/${route}`, {
    method,
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (process.env.SIM_DEBUG) console.log(method, route, response.status, text);
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const jwt = (claims: object, key: string, alg = "HS256") => {
  const head = Buffer.from(JSON.stringify({ alg, typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  if (alg === "none") return `${head}.${body}.`;
  const mac = crypto
    .createHmac("sha256", key)
    .update(`${head}.${body}`)
    .digest("base64url");
  return `${head}.${body}.${mac}`;
};

async function main() {
  const seller = device("Seller phone");
  const buyer = device("Buyer phone");
  const outsider = device("Outsider phone");

  section("Setup");
  // Opening Chats loads the list and starts listening at once; that must not make two accounts.
  const accountsBefore = Number(asSuperuser("select count(*) from auth.users"));
  const fresh = device("Fresh phone");
  const stopFresh = fresh.listen();
  await Promise.all([fresh.chat.list(), fresh.chat.list()]);
  await pause(300);
  check(
    Number(asSuperuser("select count(*) from auth.users")) - accountsBefore ===
      1,
    "a phone that loads its list and listens at the same time gets one account",
  );
  stopFresh();
  fresh.client.realtime.disconnect();

  // Opening the Chats tab signs each phone in (anonymously, until email sign-in is wired up).
  for (const phone of [seller, buyer, outsider]) {
    const list = await phone.chat.list();
    check(
      list.ok && list.value.length === 0,
      `${phone.name} signs in and has no chats yet`,
    );
  }
  const sellerSession = await seller.session();
  const buyerSession = await buyer.session();
  const outsiderSession = await outsider.session();
  const sellerId = sellerSession.user.id as UserId;
  check(
    new Set([sellerId, buyerSession.user.id, outsiderSession.user.id]).size ===
      3,
    "each phone is a different account",
  );
  // The seller lists a camera (listings have no client write path yet, so this is set up directly).
  asSuperuser(
    `insert into public.listings (slug, seller_id, title, asking_php) values ('sim-camera', '${sellerId}', 'Film camera', 1500)`,
  );

  const stopSeller = seller.listen();
  const stopBuyer = buyer.listen();
  const stopOutsider = outsider.listen();
  // The app listens from two places at once on one phone: the chat list and the open chat.
  const secondScreen: ChatEvent[] = [];
  const stopSecondScreen = seller.chat.subscribe((event) =>
    secondScreen.push(event),
  );
  await pause(500);

  section("Two phones chatting");
  const started = await buyer.chat.start("sim-camera");
  check(started.ok, "the buyer opens a chat from the listing");
  const conversation = (started.ok ? started.value : "") as ConversationId;
  const again = await buyer.chat.start("sim-camera");
  check(
    again.ok && again.value === conversation,
    "messaging the seller again reopens the same chat",
  );

  const hello = await buyer.chat.sendText(
    buyer.chat.nextMessageId(),
    conversation,
    "Hi! Is it still available?",
  );
  check(hello.ok, "the buyer sends a message", hello.ok || hello.error);
  const arrived = await seller.heardMessage(
    (event) => event.message.body === "Hi! Is it still available?",
  );
  check(
    Boolean(arrived && !arrived.message.mine),
    "it arrives live on the seller’s phone, marked as theirs",
  );
  check(
    Boolean(
      await waitFor(() =>
        secondScreen.find((event) => event.type === "message"),
      ),
    ),
    "both screens listening on the seller’s phone get it",
  );

  const sellerList = await seller.chat.list();
  const row = sellerList.ok
    ? sellerList.value.find((entry) => entry.id === conversation)
    : undefined;
  check(
    row?.unread === 1 && row.iAmSeller && row.listing.title === "Film camera",
    "the seller’s list shows it unread, about the camera",
    row,
  );
  await seller.chat.markRead(conversation);
  const afterRead = await seller.chat.list();
  check(
    afterRead.ok && afterRead.value[0]?.unread === 0,
    "opening the chat marks it read",
  );

  const reply = await seller.chat.sendText(
    seller.chat.nextMessageId(),
    conversation,
    "Yes! It works perfectly.",
  );
  check(reply.ok, "the seller replies");
  check(
    Boolean(
      await buyer.heardMessage(
        (event) =>
          event.message.body === "Yes! It works perfectly." &&
          !event.message.mine,
      ),
    ),
    "the reply arrives live on the buyer’s phone",
  );

  const offerId = buyer.chat.nextMessageId();
  await buyer.chat.sendOffer(
    offerId,
    conversation,
    1300,
    "Would you take 1,300?",
  );
  check(
    Boolean(
      await seller.heardMessage(
        (event) => event.message.offer?.amountPhp === 1300,
      ),
    ),
    "the buyer’s offer reaches the seller",
  );
  const ownAnswer = await buyer.chat.respondToOffer(offerId, true);
  check(!ownAnswer.ok, "the buyer cannot accept their own offer", ownAnswer);
  const counterId = seller.chat.nextMessageId();
  await seller.chat.sendOffer(counterId, conversation, 1400);
  check(
    Boolean(
      await buyer.heardMessage(
        (event) =>
          event.message.id === offerId &&
          event.message.offer?.status === "countered",
      ),
    ),
    "the seller counters, and the buyer sees their offer marked countered",
  );
  const lateAccept = await seller.chat.respondToOffer(offerId, true);
  check(
    !lateAccept.ok && lateAccept.error.kind === "conflict",
    "a countered offer can no longer be accepted",
  );
  const accepted = await buyer.chat.respondToOffer(counterId, true);
  check(
    accepted.ok && accepted.value === "accepted",
    "the buyer accepts the counter-offer",
  );
  check(
    Boolean(
      await seller.heardMessage(
        (event) =>
          event.message.id === counterId &&
          event.message.offer?.status === "accepted",
      ),
    ),
    "the seller sees it accepted, live",
  );

  const meetupId = seller.chat.nextMessageId();
  await seller.chat.proposeMeetup(meetupId, conversation, {
    place: "SM Megamall",
    when: "Saturday, 2:00 PM",
  });
  check(
    Boolean(
      await buyer.heardMessage(
        (event) => event.message.meetup?.place === "SM Megamall",
      ),
    ),
    "the seller proposes a pickup",
  );
  const confirmed = await buyer.chat.confirmMeetup(meetupId);
  check(confirmed.ok, "the buyer confirms it");
  check(
    Boolean(
      await seller.heardMessage(
        (event) =>
          event.message.id === meetupId &&
          event.message.meetup?.status === "confirmed",
      ),
    ),
    "the seller sees the pickup confirmed, live",
  );

  const retryId = buyer.chat.nextMessageId();
  await buyer.chat.sendText(retryId, conversation, "See you then!");
  const resent = await buyer.chat.sendText(
    retryId,
    conversation,
    "See you then!",
  );
  const thread = await seller.chat.get(conversation);
  check(
    resent.ok &&
      thread.ok &&
      thread.value.messages.filter((message) => message.id === retryId)
        .length === 1,
    "a resend after a dropped connection lands once",
  );
  const buyerThread = await buyer.chat.get(conversation);
  const ids = (result: typeof thread) =>
    result.ok
      ? result.value.messages.map(
          (message) =>
            `${message.id}:${message.offer?.status ?? ""}${message.meetup?.status ?? ""}`,
        )
      : [];
  check(
    thread.ok &&
      thread.value.messages.length === 6 &&
      ids(thread).join() === ids(buyerThread).join(),
    "both phones show the same six messages, in the same order, with the same answers",
  );

  section("The outsider tries to get in");
  const peek = await outsider.chat.get(conversation);
  check(
    !peek.ok && peek.error.kind === "authorization",
    "cannot open the chat",
  );
  const outsiderList = await outsider.chat.list();
  check(
    outsiderList.ok && outsiderList.value.length === 0,
    "does not see it in their list",
  );
  const butt = await outsider.chat.sendText(
    outsider.chat.nextMessageId(),
    conversation,
    "Sell it to me instead",
  );
  check(!butt.ok, "cannot post in it", butt.ok || butt.error);
  check(
    !(await outsider.chat.respondToOffer(counterId, false)).ok,
    "cannot answer an offer in it",
  );
  check(
    !(await outsider.chat.confirmMeetup(meetupId)).ok,
    "cannot confirm a pickup in it",
  );
  check(
    !(await outsider.chat.report(conversation, "spam")).ok,
    "cannot report it",
  );
  check(
    !outsider.heard.some(
      (event) =>
        event.type === "message" &&
        event.message.conversationId === conversation,
    ),
    "heard nothing of it live, though subscribed the whole time",
  );

  const token = outsiderSession.access_token;
  const readAll = await raw("GET", "messages?select=id,body", token);
  check(
    readAll.status === 200 && readAll.body.length === 0,
    "reading the messages table directly returns nothing",
    readAll,
  );
  const readConvos = await raw("GET", "conversations?select=id", token);
  check(
    readConvos.status === 200 && readConvos.body.length === 0,
    "reading the conversations table directly returns nothing",
  );
  const members = await raw(
    "GET",
    "conversation_members?select=user_id",
    token,
  );
  check(
    members.status === 200 && members.body.length === 0,
    "cannot find out who is talking to whom",
  );
  const spoof = await raw("POST", "messages?select=id", token, {
    conversation_id: conversation,
    body: "Hi from the seller (not really)",
    sender_id: sellerId,
  });
  check(spoof.status === 403, "cannot send a message as the seller", spoof);
  const join = await raw("POST", "conversation_members?select=user_id", token, {
    conversation_id: conversation,
    user_id: outsiderSession.user.id,
  });
  check(join.status === 403, "cannot add themselves to the chat", join);
  const hijack = await raw(
    "PATCH",
    `messages?id=eq.${counterId}&select=id`,
    token,
    { offer_status: "declined" },
  );
  check(hijack.status === 403, "cannot change an offer’s status", hijack);
  const wipe = await raw(
    "DELETE",
    `messages?conversation_id=eq.${conversation}&select=id`,
    token,
  );
  check(wipe.status === 403, "cannot delete the messages", wipe);
  const fakeListing = await raw("POST", "listings?select=id", token, {
    slug: "fake-camera",
    seller_id: sellerId,
    title: "Film camera",
    asking_php: 1,
  });
  check(
    fakeListing.status === 403,
    "cannot create a listing in the seller’s name",
    fakeListing,
  );
  const block = await raw("GET", "user_blocks?select=blocker_id", token);
  check(
    block.status === 200 && block.body.length === 0,
    "sees no one else’s blocks",
  );

  section("Even a participant cannot break the rules");
  const buyerToken = buyerSession.access_token;
  const selfAccept = await raw(
    "POST",
    "messages?select=id,offer_status",
    buyerToken,
    {
      conversation_id: conversation,
      kind: "offer",
      offer_php: 1,
      offer_status: "accepted",
    },
  );
  check(
    selfAccept.status === 403,
    "the buyer cannot send an offer that is already accepted",
    selfAccept,
  );
  const impersonate = await raw("POST", "messages?select=id", buyerToken, {
    conversation_id: conversation,
    body: "Actually, I’ll give it to you for free",
    sender_id: sellerId,
  });
  check(
    impersonate.status === 403,
    "the buyer cannot post as the seller in their own chat",
    impersonate,
  );
  const rewrite = await raw(
    "PATCH",
    `messages?id=eq.${retryId}&select=id`,
    buyerToken,
    { body: "edited" },
  );
  check(rewrite.status === 403, "nobody can rewrite a sent message", rewrite);
  const backdate = await raw("POST", "messages?select=id", buyerToken, {
    conversation_id: conversation,
    body: "from the past",
    created_at: "2020-01-01T00:00:00Z",
  });
  check(backdate.status === 403, "nobody can backdate a message", backdate);
  const selfChat = await seller.chat.start("sim-camera");
  check(
    !selfChat.ok,
    "the seller cannot open a chat with themselves about their own listing",
  );

  section("Forged and missing credentials");
  const forged = jwt(
    { sub: sellerId, role: "authenticated", exp: 4102444800 },
    "not-the-secret",
  );
  check(
    (await raw("GET", "messages?select=id", forged)).status === 401,
    "a token signed with the wrong key is refused",
  );
  const unsigned = jwt(
    { sub: sellerId, role: "authenticated", exp: 4102444800 },
    "",
    "none",
  );
  check(
    (await raw("GET", "messages?select=id", unsigned)).status === 401,
    'an unsigned ("alg: none") token is refused',
  );
  const tampered = token.split(".");
  tampered[1] = Buffer.from(
    JSON.stringify({
      ...JSON.parse(Buffer.from(tampered[1]!, "base64url").toString()),
      sub: sellerId,
    }),
  ).toString("base64url");
  check(
    (await raw("GET", "messages?select=id", tampered.join("."))).status === 401,
    "the outsider’s own token, edited to say they are the seller, is refused",
  );
  const anon = await raw("GET", "messages?select=id", anonKey);
  check(anon.status === 401, "a signed-out visitor cannot read messages", anon);
  const anonList = await raw("POST", "rpc/conversation_list", anonKey, {});
  check(
    anonList.status === 401,
    "a signed-out visitor cannot list chats",
    anonList,
  );
  const anonStart = await raw("POST", "rpc/start_conversation", anonKey, {
    listing_slug: "sim-camera",
  });
  check(
    anonStart.status >= 400,
    "a signed-out visitor cannot start a chat",
    anonStart,
  );

  section("Realtime: eavesdropping");
  // The outsider joins the seller's own channel name, then with a forged token.
  // Raw Realtime connections, each joining with exactly the token under test, so the client
  // library can't quietly swap in another one.
  const tap = (accessToken: string) => {
    const socketUrl = `${url.replace("http", "ws")}/realtime/v1/websocket?apikey=${anonKey}&vsn=2.0.0`;
    const socket = new WebSocket(socketUrl);
    const state = { joined: false, got: [] as unknown[] };
    socket.addEventListener("open", () =>
      socket.send(
        JSON.stringify([
          "1",
          "1",
          `realtime:chats:${sellerId}`,
          "phx_join",
          {
            config: {
              postgres_changes: [
                { event: "*", schema: "public", table: "messages" },
              ],
            },
            access_token: accessToken,
          },
        ]),
      ),
    );
    socket.addEventListener("message", (frame) => {
      const [, , , event, payload] = JSON.parse(String(frame.data));
      if (event === "phx_reply" && payload.status === "ok") state.joined = true;
      if (event === "postgres_changes") state.got.push(payload);
    });
    return Object.assign(state, { stop: () => socket.close() });
  };
  const control = tap(sellerSession.access_token);
  const sameName = tap(token);
  const forgedTap = tap(forged);
  const anonTap = tap(anonKey);
  await waitFor(
    () =>
      (control.joined &&
        sameName.joined &&
        forgedTap.joined &&
        anonTap.joined) ||
      undefined,
  );
  check(
    control.joined && sameName.joined && forgedTap.joined && anonTap.joined,
    "all four listeners are connected",
  );
  await buyer.chat.sendText(
    buyer.chat.nextMessageId(),
    conversation,
    "One more thing: is the strap included?",
  );
  check(
    Boolean(
      await seller.heardMessage((event) =>
        event.message.body.startsWith("One more thing"),
      ),
    ),
    "the seller hears the new message",
  );
  check(
    Boolean(await waitFor(() => control.got[0])),
    "a listener with the seller’s own token hears it too (the listeners work)",
  );
  await pause(800);
  check(
    sameName.got.length === 0,
    "the outsider’s token hears nothing, even on a channel named after the seller",
  );
  check(
    forgedTap.got.length === 0,
    "a forged token claiming to be the seller hears nothing",
  );
  check(anonTap.got.length === 0, "a signed-out visitor hears nothing");
  [control, sameName, forgedTap, anonTap].forEach((entry) => entry.stop());

  section("Blocking");
  const blocked = await seller.chat.setBlocked(
    buyerSession.user.id as UserId,
    true,
  );
  check(blocked.ok, "the seller blocks the buyer");
  const afterBlock = await buyer.chat.sendText(
    buyer.chat.nextMessageId(),
    conversation,
    "Hello?",
  );
  check(
    !afterBlock.ok && afterBlock.error.kind === "conflict",
    "the buyer can no longer send",
    afterBlock.ok || afterBlock.error,
  );
  const sellerSends = await seller.chat.sendText(
    seller.chat.nextMessageId(),
    conversation,
    "Bye",
  );
  check(!sellerSends.ok, "nor can the seller while the block stands");
  const buyerView = await buyer.chat.get(conversation);
  check(
    buyerView.ok && !buyerView.value.blockedByMe,
    "the buyer is not told who blocked whom",
  );
  await seller.chat.setBlocked(buyerSession.user.id as UserId, false);
  check(
    (
      await buyer.chat.sendText(
        buyer.chat.nextMessageId(),
        conversation,
        "Thanks!",
      )
    ).ok,
    "after unblocking, messages flow again",
  );

  section("A sale closes the chat");
  asSuperuser(
    `update public.listings set status = 'sold' where slug = 'sim-camera'`,
  );
  const closedList = await buyer.chat.list();
  check(
    closedList.ok && closedList.value[0]?.closed === "sold",
    "the buyer’s list shows it sold",
  );
  const afterSale = await buyer.chat.sendText(
    buyer.chat.nextMessageId(),
    conversation,
    "Still there?",
  );
  check(
    !afterSale.ok && afterSale.error.kind === "conflict",
    "no new messages once it has sold",
  );

  stopSeller();
  stopSecondScreen();
  stopBuyer();
  stopOutsider();
  for (const phone of [seller, buyer, outsider])
    phone.client.realtime.disconnect();
  console.log(
    failures === 0
      ? "\nAll two-device checks passed."
      : `\n${failures} check(s) failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
