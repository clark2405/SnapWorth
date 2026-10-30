#!/usr/bin/env node
// A local stand-in for the three Supabase services the chat uses, for testing without Docker or
// a Supabase project. It is NOT Supabase. It does the one job Supabase's gateway does for
// security, the same way: check the caller's JWT, then run every query in Postgres *as that
// caller* (`set local role authenticated` plus the `request.jwt.claims` setting), so row-level
// security, grants and the database's functions decide what is allowed, exactly as with
// PostgREST. Realtime is mimicked the way Supabase Realtime filters changes: before a change is
// sent to a subscriber, the row is read again under that subscriber's identity, and only a row
// their select policy lets them see is sent.
//
//   node gateway.cjs   (env: PG_BIN, PG_HOST, PG_PORT, GATEWAY_PORT, JWT_SECRET, FRONTEND_DIR)
//
// Covers only what the app's chat adapter calls: anonymous sign-up and token refresh; table
// select (eq filters, order, limit), insert with returning; RPC; postgres_changes channels.

const http = require("node:http");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const path = require("node:path");

const frontend =
  process.env.FRONTEND_DIR ?? path.resolve(__dirname, "../../../Frontend");
const { WebSocketServer } = require(
  require.resolve("ws", { paths: [frontend] }),
);

const pgBin = process.env.PG_BIN ?? "/usr/lib/postgresql/16/bin";
const pgHost = process.env.PG_HOST;
const pgPort = process.env.PG_PORT ?? "54329";
const port = Number(process.env.GATEWAY_PORT ?? 54321);
const secret = process.env.JWT_SECRET;
if (!secret || !pgHost) throw new Error("Set JWT_SECRET and PG_HOST.");

// ---------------------------------------------------------------------------------------------
// JWTs (HS256), as Supabase Auth issues them.
// ---------------------------------------------------------------------------------------------

const b64url = (data) => Buffer.from(data).toString("base64url");
const sign = (claims) => {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(claims));
  const mac = crypto
    .createHmac("sha256", secret)
    .update(`${head}.${body}`)
    .digest("base64url");
  return `${head}.${body}.${mac}`;
};
/** The token's claims, or null for a forged, malformed or expired token. */
function verify(token) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3) return null;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest("base64url");
  const given = Buffer.from(parts[2]);
  if (given.length !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(given, Buffer.from(expected))) return null;
  let header;
  let claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  } catch {
    return null;
  }
  if (header.alg !== "HS256") return null;
  if (typeof claims.exp === "number" && claims.exp < Date.now() / 1000)
    return null;
  if (!["anon", "authenticated"].includes(claims.role)) return null;
  return claims;
}

const anonKey = sign({
  role: "anon",
  iss: "chat-sim",
  iat: 0,
  exp: 4102444800,
});

// ---------------------------------------------------------------------------------------------
// Postgres, through psql. Values only ever reach SQL as psql variables (`:'p0'`), which psql
// quotes as literals; identifiers are checked against a strict pattern before use.
// ---------------------------------------------------------------------------------------------

function psql(sql, vars = {}) {
  return new Promise((resolve) => {
    const args = [
      "-X",
      "-q",
      "-At",
      "-h",
      pgHost,
      "-p",
      pgPort,
      "-U",
      "postgres",
      "-d",
      "postgres",
    ];
    args.push("-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose");
    for (const [name, value] of Object.entries(vars))
      args.push("-v", `${name}=${value}`);
    const child = spawn(path.join(pgBin, "psql"), args);
    let out = "";
    let errText = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (errText += chunk));
    child.on("close", (code) => {
      if (code === 0) return resolve({ ok: true, out: out.trim() });
      const match = /ERROR:\s+([0-9A-Z]{5}):\s+([^\n]*)/.exec(errText);
      resolve({
        ok: false,
        code: match?.[1] ?? "XX000",
        message: match?.[2] ?? errText.trim(),
      });
    });
    child.stdin.end(sql);
  });
}

const ident = (name) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name))
    throw Object.assign(new Error("bad identifier"), { status: 400 });
  return name;
};

/** Runs `query` as the caller: their database role and their JWT claims, in one transaction. */
async function asCaller(claims, query, values) {
  const vars = { claims: JSON.stringify(claims) };
  values.forEach(
    (value, index) => (vars[`p${index}`] = value === null ? "" : String(value)),
  );
  const sql = [
    "begin;",
    `set local role ${claims.role === "authenticated" ? "authenticated" : "anon"};`,
    "select set_config('request.jwt.claims', :'claims', true) as ignored \\gset",
    `${query};`,
    "commit;",
  ].join("\n");
  return psql(sql, vars);
}

/** `NULL` for a JSON null, otherwise the next psql variable. */
function bindValue(value, values) {
  if (value === null || value === undefined) return "NULL";
  values.push(typeof value === "object" ? JSON.stringify(value) : value);
  return `:'p${values.length - 1}'`;
}

function columnsOf(select) {
  if (!select || select === "*") return "*";
  return select
    .split(",")
    .map((column) => ident(column.trim()))
    .join(", ");
}

const functionShapes = new Map();
async function returnsSet(name) {
  if (!functionShapes.has(name)) {
    const result = await psql(
      `select bool_or(proretset) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = :'name'`,
      { name },
    );
    functionShapes.set(name, result.ok && result.out === "t");
  }
  return functionShapes.get(name);
}

function pgError(result, claims) {
  let status = 400;
  if (result.code === "42501")
    status = claims.role === "authenticated" ? 403 : 401;
  else if (result.code === "23505") status = 409;
  else if (result.code === "P0002") status = 404;
  return {
    status,
    body: {
      code: result.code,
      message: result.message,
      details: null,
      hint: null,
    },
  };
}

async function rest(req, claims, url, body) {
  const [, , , kind, name] = url.pathname.split("/");
  const values = [];
  const wantsOne = (req.headers.accept ?? "").includes("vnd.pgrst.object");

  if (kind === "rpc") {
    const args = Object.entries(body ?? {})
      .map(([key, value]) => `${ident(key)} := ${bindValue(value, values)}`)
      .join(", ");
    const call = `public.${ident(name)}(${args})`;
    const query = (await returnsSet(name))
      ? `select coalesce(json_agg(t), '[]'::json) from ${call} t`
      : `select to_json(${call})`;
    const result = await asCaller(claims, query, values);
    if (!result.ok) return pgError(result, claims);
    return { status: 200, body: result.out ? JSON.parse(result.out) : null };
  }

  const table = `public.${ident(kind)}`;
  const select = columnsOf(url.searchParams.get("select"));

  const filters = () => {
    const where = [];
    let order = "";
    let limit = "";
    for (const [key, raw] of url.searchParams) {
      if (key === "select") continue;
      if (key === "order") {
        const [column, direction] = raw.split(".");
        order = ` order by ${ident(column)} ${direction === "desc" ? "desc" : "asc"}`;
      } else if (key === "limit") {
        limit = ` limit ${Number.parseInt(raw, 10) || 0}`;
      } else if (raw.startsWith("eq.")) {
        where.push(`${ident(key)} = ${bindValue(raw.slice(3), values)}`);
      } else {
        throw Object.assign(new Error(`unsupported filter ${key}`), {
          status: 400,
        });
      }
    }
    return {
      where: where.length ? ` where ${where.join(" and ")}` : "",
      order,
      limit,
    };
  };

  if (req.method === "GET") {
    const { where, order, limit } = filters();
    const query = `select coalesce(json_agg(t), '[]'::json) from (select ${select} from ${table}${where}${order}${limit}) t`;
    const result = await asCaller(claims, query, values);
    if (!result.ok) return pgError(result, claims);
    const rows = JSON.parse(result.out);
    if (!wantsOne) return { status: 200, body: rows };
    if (rows.length !== 1) {
      return {
        status: 406,
        body: { code: "PGRST116", message: `${rows.length} rows` },
      };
    }
    return { status: 200, body: rows[0] };
  }

  if (req.method === "PATCH" || req.method === "DELETE") {
    const sets = Object.entries(body ?? {}).map(
      ([column, value]) => `${ident(column)} = ${bindValue(value, values)}`,
    );
    const { where } = filters();
    const statement =
      req.method === "PATCH"
        ? `update ${table} set ${sets.join(", ")}${where} returning ${select}`
        : `delete from ${table}${where} returning ${select}`;
    const result = await asCaller(
      claims,
      `with changed as (${statement}) select coalesce(json_agg(changed), '[]'::json) from changed`,
      values,
    );
    if (!result.ok) return pgError(result, claims);
    return { status: 200, body: JSON.parse(result.out) };
  }

  if (req.method === "POST") {
    const rows = Array.isArray(body) ? body : [body];
    const columns = Object.keys(rows[0] ?? {}).map(ident);
    const tuples = rows.map(
      (row) =>
        `(${columns.map((column) => bindValue(row[column], values)).join(", ")})`,
    );
    const returning = (req.headers.prefer ?? "").includes(
      "return=representation",
    );
    const query = `with ins as (insert into ${table} (${columns.join(", ")}) values ${tuples.join(
      ", ",
    )} returning ${returning ? select : "1 as done"}) select coalesce(json_agg(ins), '[]'::json) from ins`;
    const result = await asCaller(claims, query, values);
    if (!result.ok) return pgError(result, claims);
    if (!returning) return { status: 201, body: null };
    const inserted = JSON.parse(result.out);
    return { status: 201, body: wantsOne ? inserted[0] : inserted };
  }

  return {
    status: 405,
    body: { code: "PGRST105", message: "method not supported here" },
  };
}

// ---------------------------------------------------------------------------------------------
// Auth: anonymous sign-up and refresh, which is all the chat adapter uses.
// ---------------------------------------------------------------------------------------------

const refreshTokens = new Map();

function sessionFor(userId) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    is_anonymous: true,
    iat: now,
    exp: now + 3600,
  };
  const refresh = crypto.randomBytes(24).toString("hex");
  refreshTokens.set(refresh, userId);
  return {
    access_token: sign(claims),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: claims.exp,
    refresh_token: refresh,
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      is_anonymous: true,
      app_metadata: { provider: "anonymous", providers: [] },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
    },
  };
}

async function auth(req, url, body) {
  const route = url.pathname.replace("/auth/v1/", "");
  if (route === "signup" && req.method === "POST") {
    if (body?.email || body?.phone) {
      return {
        status: 422,
        body: { msg: "Only anonymous sign-up is simulated." },
      };
    }
    const id = crypto.randomUUID();
    const result = await psql(
      "insert into auth.users (id, aud, role, is_anonymous, raw_user_meta_data, created_at) values (:'id', 'authenticated', 'authenticated', true, '{}', now())",
      { id },
    );
    if (!result.ok) return { status: 500, body: { msg: result.message } };
    return { status: 200, body: sessionFor(id) };
  }
  if (
    route === "token" &&
    url.searchParams.get("grant_type") === "refresh_token"
  ) {
    const userId = refreshTokens.get(body?.refresh_token);
    if (!userId) return { status: 400, body: { error: "invalid_grant" } };
    refreshTokens.delete(body.refresh_token);
    return { status: 200, body: sessionFor(userId) };
  }
  if (route === "user" && req.method === "GET") {
    const claims = verify(
      (req.headers.authorization ?? "").replace(/^Bearer /, ""),
    );
    if (!claims?.sub) return { status: 401, body: { msg: "invalid token" } };
    return { status: 200, body: sessionFor(claims.sub).user };
  }
  if (route === "logout") return { status: 204, body: null };
  return { status: 404, body: { msg: `${route} is not simulated` } };
}

// ---------------------------------------------------------------------------------------------
// HTTP.
// ---------------------------------------------------------------------------------------------

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-expose-headers": "*",
};

const server = http.createServer(async (req, res) => {
  const send = ({ status, body }) => {
    res.writeHead(status, { ...cors, "content-type": "application/json" });
    res.end(body === null || body === undefined ? "" : JSON.stringify(body));
  };
  if (req.method === "OPTIONS") return send({ status: 204, body: null });
  try {
    const url = new URL(req.url, "http://local");
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : undefined;

    if (url.pathname.startsWith("/auth/v1/"))
      return send(await auth(req, url, body));
    if (url.pathname.startsWith("/rest/v1/")) {
      // Like Supabase: the apikey must be the project's key, and the bearer token decides who you are.
      if (req.headers.apikey !== anonKey)
        return send({ status: 401, body: { message: "bad apikey" } });
      const claims = verify(
        (req.headers.authorization ?? "").replace(/^Bearer /, ""),
      );
      if (!claims)
        return send({
          status: 401,
          body: { code: "PGRST301", message: "JWT invalid" },
        });
      const answer = await rest(req, claims, url, body);
      if (process.env.SIM_DEBUG)
        console.error(
          req.method,
          req.url,
          answer.status,
          JSON.stringify(answer.body).slice(0, 300),
        );
      return send(answer);
    }
    if (url.pathname === "/sim/anon-key")
      return send({ status: 200, body: { anonKey } });
    return send({ status: 404, body: { message: "not found" } });
  } catch (error) {
    return send({
      status: error.status ?? 500,
      body: { message: String(error.message ?? error) },
    });
  }
});

// ---------------------------------------------------------------------------------------------
// Realtime: postgres_changes over Phoenix channels (serializer 2.0.0: JSON arrays).
// ---------------------------------------------------------------------------------------------

const subscriptions = new Set(); // { socket, topic, claims, bindings: [{ id, event, table }] }
let nextBindingId = 1;

const wss = new WebSocketServer({ server, path: "/realtime/v1/websocket" });
wss.on("connection", (socket, req) => {
  const url = new URL(req.url, "http://local");
  if (url.searchParams.get("apikey") !== anonKey)
    return socket.close(4001, "bad apikey");
  const reply = (joinRef, ref, topic, status, response) =>
    socket.send(
      JSON.stringify([joinRef, ref, topic, "phx_reply", { status, response }]),
    );

  socket.on("message", (data) => {
    let frame;
    try {
      frame = JSON.parse(String(data));
    } catch {
      return;
    }
    const [joinRef, ref, topic, event, payload] = frame;
    if (topic === "phoenix" && event === "heartbeat")
      return reply(null, ref, topic, "ok", {});

    if (event === "phx_join") {
      const claims = verify(payload?.access_token) ?? verify(anonKey);
      const wanted = payload?.config?.postgres_changes ?? [];
      const bindings = wanted.map((binding) => ({
        id: nextBindingId++,
        ...binding,
      }));
      subscriptions.add({ socket, topic, joinRef, claims, bindings });
      return reply(joinRef, ref, topic, "ok", {
        postgres_changes: bindings.map(
          ({ id, event: e, schema, table, filter }) => ({
            id,
            event: e,
            schema,
            table,
            ...(filter ? { filter } : {}),
          }),
        ),
      });
    }
    if (event === "access_token") {
      const claims = verify(payload?.access_token);
      for (const sub of subscriptions)
        if (sub.socket === socket && sub.topic === topic && claims)
          sub.claims = claims;
      return;
    }
    if (event === "phx_leave") {
      for (const sub of subscriptions)
        if (sub.socket === socket && sub.topic === topic)
          subscriptions.delete(sub);
      return reply(joinRef, ref, topic, "ok", {});
    }
    return reply(joinRef, ref, topic, "ok", {});
  });
  socket.on("close", () => {
    for (const sub of subscriptions)
      if (sub.socket === socket) subscriptions.delete(sub);
  });
});

// Changes come from a trigger the start script adds to a scratch schema (never a migration).
let lastSeq = 0;
const columnTypes = new Map();

async function columnsFor(table) {
  if (!columnTypes.has(table)) {
    const result = await psql(
      `select json_agg(json_build_object('name', attname, 'type', format_type(atttypid, null)))
         from pg_attribute where attrelid = ('public.' || :'t')::regclass and attnum > 0 and not attisdropped`,
      { t: table },
    );
    columnTypes.set(table, result.ok ? JSON.parse(result.out) : []);
  }
  return columnTypes.get(table);
}

async function pump() {
  const result = await psql(
    `select coalesce(json_agg(c order by c.seq), '[]'::json)
       from sim.changes c where c.seq > :'last'`,
    { last: lastSeq },
  );
  if (!result.ok) return;
  for (const change of JSON.parse(result.out)) {
    lastSeq = change.seq;
    const columns = await columnsFor(change.table_name);
    for (const sub of subscriptions) {
      const matches = sub.bindings.filter(
        (binding) =>
          (binding.table === change.table_name || binding.table === "*") &&
          (binding.event === "*" || binding.event === change.op),
      );
      if (!matches.length) continue;
      // The subscriber sees the row only if their own select policy lets them read it now.
      const visible = await asCaller(
        sub.claims,
        `select coalesce(json_agg(r), '[]'::json) from public.${ident(change.table_name)} r where r.id = :'p0'`,
        [change.row_id],
      );
      if (!visible.ok) continue;
      const [record] = JSON.parse(visible.out);
      if (!record) continue;
      sub.socket.send(
        JSON.stringify([
          null,
          null,
          sub.topic,
          "postgres_changes",
          {
            ids: matches.map((binding) => binding.id),
            data: {
              schema: "public",
              table: change.table_name,
              commit_timestamp: change.at,
              type: change.op,
              columns,
              record,
              old_record:
                change.op === "UPDATE" ? { id: change.row_id } : undefined,
              errors: null,
            },
          },
        ]),
      );
    }
  }
}

(async function loop() {
  for (;;) {
    await pump().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
})();

server.listen(port, "127.0.0.1", () => {
  console.log(
    JSON.stringify({
      url: `http://127.0.0.1:${port}`,
      anonKey,
      pgHost,
      pgPort,
    }),
  );
});
