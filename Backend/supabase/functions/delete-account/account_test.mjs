import assert from "node:assert/strict";
import { test } from "node:test";

import {
  accountBuckets,
  createDeleteAccountHandler,
  removeAccountFiles,
  removeBatch,
} from "./account.ts";

const userId = "8b0c6a52-5a3e-4d7e-9b7a-3f1f6c0d2e11";
const request = (body = { confirm: "DELETE" }, token = "session-token", method = "POST") =>
  new Request("https://example.test/delete-account", {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

/** Storage as a map of bucket → file paths; a bucket left out doesn't exist. */
function memoryFiles(buckets) {
  const removed = [];
  const files = {
    async list(bucket, folder, offset, limit) {
      const paths = buckets[bucket];
      if (!paths) return null;
      const inside = paths.filter((path) => path.startsWith(`${folder}/`));
      const names = [...new Set(inside.map((path) => path.slice(folder.length + 1).split("/")[0]))];
      return names.sort().slice(offset, offset + limit).map((name) => ({
        name,
        folder: !inside.includes(`${folder}/${name}`),
      }));
    },
    async remove(bucket, paths) {
      removed.push({ bucket, paths });
      buckets[bucket] = buckets[bucket].filter((path) => !paths.includes(path));
    },
  };
  return { files, removed, buckets };
}

function setup(overrides = {}) {
  const deleted = [];
  const storage = memoryFiles({
    avatars: [`${userId}/avatar.jpg`, "someone-else/avatar.jpg"],
    "scan-photos": [`${userId}/scan-1.jpg`, `${userId}/scan-2.jpg`, "someone-else/scan-3.jpg"],
  });
  const handler = createDeleteAccountHandler({
    authenticate: async (token) => (token === "session-token" ? userId : null),
    files: storage.files,
    deleteUser: async (id) => {
      deleted.push(id);
    },
    ...overrides,
  });
  return { handler, deleted, storage };
}

test("deletes the signed-in person's files and then their account", async () => {
  const { handler, deleted, storage } = setup();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
  assert.deepEqual(deleted, [userId]);
  assert.deepEqual(storage.buckets.avatars, ["someone-else/avatar.jpg"]);
  assert.deepEqual(storage.buckets["scan-photos"], ["someone-else/scan-3.jpg"]);
});

test("looks inside folders below the person's own", async () => {
  const storage = memoryFiles({ avatars: [`${userId}/old/avatar.png`, `${userId}/avatar.webp`] });
  assert.equal(await removeAccountFiles(storage.files, userId), 2);
  assert.deepEqual(storage.buckets.avatars, []);
});

test("needs a session Auth accepts, and touches nothing without one", async () => {
  const { handler, deleted, storage } = setup();
  assert.equal((await handler(request(undefined, ""))).status, 401);
  assert.equal((await handler(request(undefined, "forged-token"))).status, 401);
  assert.deepEqual(deleted, []);
  assert.equal(storage.removed.length, 0);
});

test("says so when Auth can't be reached, rather than treating the caller as signed out", async () => {
  const { handler, deleted } = setup({
    authenticate: async () => {
      throw new Error("Auth is down");
    },
  });
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { code: "authentication_unavailable" });
  assert.deepEqual(deleted, []);
});

test("needs the typed confirmation, exactly", async () => {
  const { handler, deleted } = setup();
  for (const body of [{}, { confirm: "delete" }, { confirm: "yes" }, { confirm: true }]) {
    const response = await handler(request(body));
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.deepEqual(await response.json(), { code: "confirmation_required" });
  }
  const notJson = new Request("https://example.test/delete-account", {
    method: "POST",
    headers: { authorization: "Bearer session-token" },
    body: "DELETE",
  });
  assert.equal((await handler(notJson)).status, 400);
  assert.deepEqual(deleted, []);
});

test("answers only POST, and the browser's preflight", async () => {
  const { handler, deleted } = setup();
  assert.equal((await handler(request(undefined, "session-token", "GET"))).status, 405);
  const preflight = await handler(request(undefined, "session-token", "OPTIONS"));
  assert.equal(preflight.status, 200);
  assert.match(preflight.headers.get("access-control-allow-headers"), /authorization/);
  assert.deepEqual(deleted, []);
});

test("keeps the account when its files can't be removed, so trying again finishes the job", async () => {
  let failing = true;
  const { deleted, storage } = setup();
  const files = {
    list: storage.files.list,
    async remove(bucket, paths) {
      if (failing) throw new Error("Storage is down");
      await storage.files.remove(bucket, paths);
    },
  };
  const retrying = createDeleteAccountHandler({
    authenticate: async () => userId,
    files,
    deleteUser: async (id) => {
      deleted.push(id);
    },
  });
  const response = await retrying(request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { code: "files_not_removed" });
  assert.deepEqual(deleted, []);

  failing = false;
  assert.equal((await retrying(request())).status, 200);
  assert.deepEqual(deleted, [userId]);
});

test("reports an account Auth wouldn't delete", async () => {
  const { handler } = setup({
    deleteUser: async () => {
      throw new Error("database error deleting user");
    },
  });
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { code: "not_deleted" });
});

test("limits repeated attempts from one account", async () => {
  const { handler } = setup({
    deleteUser: async () => {
      throw new Error("database error deleting user");
    },
  });
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal((await handler(request())).status, 503);
  }
  const response = await handler(request());
  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { code: "rate_limited" });
});

test("skips buckets that don't exist yet", async () => {
  const storage = memoryFiles({ avatars: [`${userId}/avatar.jpg`] });
  assert.equal(await removeAccountFiles(storage.files, userId), 1);
  assert.deepEqual(storage.buckets.avatars, []);
  // The scan-photos bucket was missing here, and nothing else was asked of it.
  assert.deepEqual([...accountBuckets].sort(), ["avatars", "scan-photos"]);
});

test("finds files in every page of a big folder and removes them in batches", async () => {
  const many = Array.from({ length: removeBatch + 150 }, (_, n) => `${userId}/scan-${String(n).padStart(5, "0")}.jpg`);
  const storage = memoryFiles({ "scan-photos": [...many] });
  assert.equal(await removeAccountFiles(storage.files, userId), many.length);
  assert.deepEqual(storage.buckets["scan-photos"], []);
  assert.deepEqual(storage.removed.map((call) => call.paths.length), [removeBatch, 150]);
});
