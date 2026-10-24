// Compare reasoning settings using repository photos and the real pricing handler.
// node --experimental-strip-types Backend/scripts/benchmark-pricing.mjs
// Uses the local Gemini key; does not deploy or change the active estimator.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

import { createEstimateHandler } from '../supabase/functions/estimate-price/pricing.ts';

const config = await readFile(new URL('../supabase/.env.local', import.meta.url), 'utf8');
const setting = (name) => (config.split(/\r?\n/).find((line) => line.startsWith(`${name}=`))
  ?.slice(name.length + 1).trim() ?? '').replace(/^(['"])(.*)\1$/, '$2');
if (setting('AI_PROVIDER') !== 'gemini' || !setting('AI_API_KEY')) {
  throw new Error('Configure the local Gemini key before benchmarking.');
}

const photos = ['windbreaker-teal', 'polaroid-camera', 'jordan-bred', 'keyboard', 'walkman'];
const model = 'gemini-3.6-flash';
const startedAt = new Date().toISOString();
const directory = new URL('../../docs/benchmarks/', import.meta.url);
const reportUrl = new URL(`gemini-3.6-${startedAt.replace(/[:.]/g, '-')}.json`, directory);
await mkdir(directory, { recursive: true });
const report = {
  model, startedAt, plannedRequests: 20,
  method: 'Sequential local pricing-handler calls with real Gemini; two rounds, five photos, low and medium. Alternate setting order. At least six seconds between starts. Same prompt and 4096-token budget. No automatic retries. Not an end-to-end mobile test.',
  limitation: 'No known sale prices; this measures response reliability, latency and price repeatability, not accuracy. Small repository images do not represent full phone uploads.',
  results: [],
};
const save = () => writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Report: ${fileURLToPath(reportUrl)}`);
await save();
let previousStart = 0;
let stopForQuota = false;
for (let round = 1; round <= 2 && !stopForQuota; round++) {
  for (const [photoIndex, photo] of photos.entries()) {
    const bytes = await readFile(new URL(`../../Frontend/shared/src/features/preview/images/${photo}.jpg`, import.meta.url));
    const levels = (round + photoIndex) % 2 ? ['low', 'medium'] : ['medium', 'low'];
    for (const thinkingLevel of levels) {
      await delay(Math.max(0, 6000 - (Date.now() - previousStart)));
      let providerStatus;
      let providerCode;
      // Each independent local trial has a fresh prototype guard. This does not
      // bypass deployed auth/quotas: no public endpoint is used by this script.
      const handler = createEstimateHandler({
        apiKey: setting('AI_API_KEY'), model, thinkingLevel,
        authenticate: async () => 'local-benchmark',
        fetch: async (...args) => {
          const response = await fetch(...args);
          providerStatus = response.status;
          if (!response.ok) {
            const body = await response.clone().json().catch(() => ({}));
            providerCode = body.error?.status;
          }
          return response;
        },
      });
      previousStart = Date.now();
      const response = await handler(new Request('https://local.test/estimate-price', {
        method: 'POST',
        headers: { authorization: 'Bearer local-benchmark', 'content-type': 'application/json' },
        body: JSON.stringify({ image: { mimeType: 'image/jpeg', data: bytes.toString('base64') } }),
      }));
      const result = await response.json();
      const row = {
        trial: report.results.length + 1, round, photo, thinkingLevel,
        elapsedMs: Date.now() - previousStart, httpStatus: response.status,
        providerStatus, providerCode, ...result,
      };
      report.results.push(row);
      console.log(JSON.stringify(row));
      await save();
      if (response.status === 429) {
        report.stoppedReason = 'Provider quota reached; stopped rather than retrying rate-limited requests.';
        stopForQuota = true;
        break;
      }
    }
    if (stopForQuota) break;
  }
}

report.finishedAt = new Date().toISOString();
report.summary = Object.fromEntries(['low', 'medium'].map((level) => {
  const rows = report.results.filter((row) => row.thinkingLevel === level);
  const times = rows.map((row) => row.elapsedMs).sort((a, b) => a - b);
  const priced = rows.filter((row) => row.status === 'estimated');
  const estimateTimes = priced.map((row) => row.elapsedMs).sort((a, b) => a - b);
  const medianEstimateMs = estimateTimes.length ?
    (estimateTimes[Math.floor((estimateTimes.length - 1) / 2)] + estimateTimes[Math.floor(estimateTimes.length / 2)]) / 2 : null;
  const median = times.length ? (times[Math.floor((times.length - 1) / 2)] + times[Math.floor(times.length / 2)]) / 2 : null;
  return [level, {
    trials: rows.length, priceEstimates: priced.length,
    needsMoreDetail: rows.filter((row) => row.status === 'unable_to_estimate').length,
    errors: rows.filter((row) => row.httpStatus !== 200).length,
    providerUnavailable: rows.filter((row) => row.providerStatus === 503).length,
    quotaErrors: rows.filter((row) => row.httpStatus === 429).length,
    estimatesWithin20Seconds: priced.filter((row) => row.elapsedMs <= 20000).length,
    medianMs: median, p90Ms: times.length ? times[Math.ceil(times.length * 0.9) - 1] : null,
    slowestMs: times.at(-1) ?? null,
    medianEstimateMs,
    slowestEstimateMs: estimateTimes.at(-1) ?? null,
  }];
}));
await save();
console.log(JSON.stringify({ summary: report.summary, stoppedReason: report.stoppedReason }));
console.log(`Saved: ${fileURLToPath(reportUrl)}`);
