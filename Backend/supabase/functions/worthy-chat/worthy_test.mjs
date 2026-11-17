import assert from "node:assert/strict";
import { test } from "node:test";

import { createWorthyHandler } from "./worthy.ts";

const request = (body, token = "session-token") =>
  new Request("https://example.test/worthy-chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

function geminiReturning(value) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }],
    }),
  };
}

function setup(reply, overrides = {}) {
  const calls = [];
  const handler = createWorthyHandler({
    apiKey: "private-test-key",
    model: "gemini-3.6-flash",
    authenticate: async (token) => (token === "session-token" ? "user-1" : null),
    fetch: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return geminiReturning(reply);
    },
    ...overrides,
  });
  return { handler, calls };
}

const answer = {
  intent: "listing",
  reply: "Here's a draft for your Walkman. I kept it honest about the wear.",
  draftTitle: "Sony Walkman WM-24, red, working",
  draftDescription: "Red Sony Walkman WM-24 cassette player with headphones.",
};

test("answers a signed-in person from their own things, with a listing draft", async () => {
  const { handler, calls } = setup(answer);
  const response = await handler(
    request({
      question: "Write my listing",
      history: [{ role: "user", text: "hi" }, { role: "worthy", text: "Hello!" }],
      context: {
        scans: [{ title: "Sony Walkman WM-24", estimatePhp: 3500, lowPhp: 2000, highPhp: 6500 }],
      },
    }),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.intent, "listing");
  assert.deepEqual(body.draft, {
    title: "Sony Walkman WM-24, red, working",
    description: "Red Sony Walkman WM-24 cassette player with headphones.",
  });
  // The key goes in a header, never the URL; the person's things travel as data.
  assert.ok(!calls[0].url.includes("private-test-key"));
  const sent = JSON.stringify(calls[0].body.contents);
  assert.ok(sent.includes("Sony Walkman WM-24"));
  assert.equal(calls[0].body.contents.length, 3);
});

test("refuses anyone not signed in", async () => {
  const { handler, calls } = setup(answer);
  const response = await handler(request({ question: "hi" }, "someone-else"));
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test("refuses an empty question", async () => {
  const { handler } = setup(answer);
  const response = await handler(request({ question: "   " }));
  assert.equal(response.status, 400);
});

test("drops malformed context instead of passing it on", async () => {
  const { handler, calls } = setup({ ...answer, intent: "chat", draftTitle: null, draftDescription: null });
  await handler(
    request({
      question: "What can you do?",
      context: { scans: [{ title: 42 }, "nonsense", { title: "Lamp", estimatePhp: -5 }] },
    }),
  );
  const sent = calls[0].body.contents.at(-1).parts[0].text;
  assert.ok(sent.includes('"title":"Lamp"'));
  assert.ok(sent.includes('"estimatePhp":null'));
  assert.ok(!sent.includes("nonsense"));
});

test("rejects a reply that isn't one of Worthy's intents", async () => {
  const { handler } = setup({ ...answer, intent: "hack" });
  const response = await handler(request({ question: "hi" }));
  assert.equal(response.status, 502);
});

test("says when it isn't set up", async () => {
  const { handler } = setup(answer, { apiKey: "" });
  const response = await handler(request({ question: "hi" }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "not_configured");
});

test("limits how fast one person can ask", async () => {
  const { handler } = setup({ ...answer, intent: "chat", draftTitle: null, draftDescription: null });
  let last;
  for (let i = 0; i < 9; i += 1) last = await handler(request({ question: `q${i}` }));
  assert.equal(last.status, 429);
});

test("tries again when Gemini is briefly overloaded", async () => {
  let calls = 0;
  const handler = createWorthyHandler({
    apiKey: "private-test-key",
    model: "gemini-3.6-flash",
    authenticate: async () => "user-2",
    fetch: async () => {
      calls += 1;
      return calls === 1
        ? new Response('{"error":{"status":"UNAVAILABLE"}}', { status: 503 })
        : geminiReturning({ ...answer, intent: "chat", draftTitle: null, draftDescription: null });
    },
  });
  const response = await handler(request({ question: "hi" }));
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});

test("falls back to a lighter model while the main one is overloaded", async () => {
  const models = [];
  const handler = createWorthyHandler({
    apiKey: "private-test-key",
    model: "gemini-3.6-flash",
    authenticate: async () => "user-3",
    fetch: async (url) => {
      models.push(/models\/([^:]+):/.exec(url)[1]);
      return models.length === 1
        ? new Response('{"error":{"code":503}}', { status: 503 })
        : geminiReturning({ ...answer, intent: "chat", draftTitle: null, draftDescription: null });
    },
  });
  const response = await handler(request({ question: "hi" }));
  assert.equal(response.status, 200);
  assert.deepEqual(models, ["gemini-3.6-flash", "gemini-3.5-flash-lite"]);
});
