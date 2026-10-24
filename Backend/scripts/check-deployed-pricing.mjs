// End-to-end check using public project settings and a non-sensitive sample.
// API keys and temporary session tokens are never printed.
import { readFile } from "node:fs/promises";

const config = await readFile(
  new URL("../../Frontend/mobile/.env.local", import.meta.url),
  "utf8",
);
function setting(name) {
  return (
    config
      .split(/\r?\n/)
      .find((line) => line.startsWith(`${name}=`))
      ?.slice(name.length + 1)
      .trim() ?? ""
  ).replace(/^(['"])(.*)\1$/, "$2");
}
const project = setting("EXPO_PUBLIC_SUPABASE_URL");
const apiKey = setting("EXPO_PUBLIC_SUPABASE_ANON_KEY");
if (!project || !apiKey)
  throw new Error("Mobile Supabase settings are missing.");
const sessionResponse = await fetch(`${project}/auth/v1/signup`, {
  method: "POST",
  headers: { apikey: apiKey, "content-type": "application/json" },
  body: "{}",
  signal: AbortSignal.timeout(20_000),
});
const session = await sessionResponse.json();
if (!sessionResponse.ok || !session.access_token) {
  console.error(
    JSON.stringify({
      stage: "anonymous_session",
      status: sessionResponse.status,
      code: session.error_code ?? session.code,
    }),
  );
  process.exit(1);
}
console.log("Anonymous session created");
const image = await readFile(
  new URL(
    "../../Frontend/shared/src/features/preview/images/windbreaker-teal.jpg",
    import.meta.url,
  ),
);
const started = Date.now();
const response = await fetch(`${project}/functions/v1/estimate-price`, {
  method: "POST",
  headers: {
    apikey: apiKey,
    authorization: `Bearer ${session.access_token}`,
    "content-type": "application/json",
    ...(process.env.PRICING_TEST_REGION
      ? { "x-region": process.env.PRICING_TEST_REGION }
      : {}),
  },
  body: JSON.stringify({
    image: { mimeType: "image/jpeg", data: image.toString("base64") },
  }),
  signal: AbortSignal.timeout(80_000),
});
const result = await response.json();
console.log(
  JSON.stringify({
    status: response.status,
    region: response.headers.get("x-sb-edge-region"),
    elapsedMs: Date.now() - started,
    code: result.code,
    result: result.status,
    itemName: result.itemName,
    amountPhp: result.amountPhp,
    lowPhp: result.lowPhp,
    highPhp: result.highPhp,
  }),
);
if (!response.ok || result.status !== "estimated") process.exitCode = 1;
