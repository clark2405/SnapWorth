// A single live smoke test using a repository sample photo, not a user's photo.
// Run from the repository root: node --experimental-strip-types Backend/scripts/check-pricing.mjs
import { readFile } from "node:fs/promises";

import { createEstimateHandler, defaultPricingModel } from "../supabase/functions/estimate-price/pricing.ts";

const config = await readFile(
  new URL("../supabase/.env.local", import.meta.url),
  "utf8",
);
const readSetting = (name) => {
  const value =
    config
      .split(/\r?\n/)
      .find((line) => line.startsWith(`${name}=`))
      ?.slice(name.length + 1)
      .trim() ?? "";
  return value.replace(/^(['"])(.*)\1$/, "$2");
};
if (readSetting("AI_PROVIDER") !== "gemini" || !readSetting("AI_API_KEY")) {
  throw new Error(
    "Fill in AI_PROVIDER=gemini and AI_API_KEY in Backend/supabase/.env.local.",
  );
}
const image = await readFile(
  new URL(
    "../../Frontend/shared/src/features/preview/images/windbreaker-teal.jpg",
    import.meta.url,
  ),
);
const model = process.env.PRICING_TEST_MODEL || readSetting("AI_MODEL") || defaultPricingModel;
const thinkingLevel = process.env.PRICING_TEST_THINKING || readSetting("AI_THINKING_LEVEL") || undefined;
const handler = createEstimateHandler({
  apiKey: readSetting("AI_API_KEY"),
  model,
  thinkingLevel,
  fetch: async (...args) => {
    const response = await fetch(...args);
    if (!response.ok) {
      const diagnostic = await response.clone().json().catch(() => ({}));
      console.error(JSON.stringify({
        stage: 'provider',
        status: response.status,
        code: diagnostic.error?.status,
      }));
    }
    return response;
  },
  // This is a local test of the pricing logic, not the deployed session validator.
  authenticate: async () => "local-smoke-test",
});
const started = Date.now();
const response = await handler(
  new Request("https://local.test/estimate-price", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer local-test",
    },
    body: JSON.stringify({
      image: { mimeType: "image/jpeg", data: image.toString("base64") },
    }),
  }),
);
const result = await response.json();
if (!response.ok) {
  console.error(`Pricing smoke test failed: ${response.status} ${result.code} (${Date.now() - started} ms)`);
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify({
      status: result.status,
      model,
      thinkingLevel: thinkingLevel ?? 'default',
      elapsedMs: Date.now() - started,
      itemName: result.itemName,
      amountPhp: result.amountPhp,
      lowPhp: result.lowPhp,
      highPhp: result.highPhp,
    }),
  );
}
