# Gemini 3.6 low versus medium

Run: 2026-10-18. Planned 20 requests; completed 14 before Gemini returned
HTTP 429 RESOURCE_EXHAUSTED. The run stopped without retrying the quota error.
The quota response does not establish whether the exhausted limit was per-minute or daily.

| Metric | Low | Medium |
| --- | ---: | ---: |
| Attempts | 7 | 7 |
| Returned a validated price | 6 | 5 |
| Provider 503 UNAVAILABLE | 1 | 1 |
| Quota errors | 0 | 1 |
| Median time for successful estimates | 3.50 seconds | 6.59 seconds |
| Slowest successful estimate | 20.11 seconds | 21.50 seconds |
| Price returned within 20 seconds | 5 | 4 |

Five non-sensitive repository photos: jacket, instant camera, sneakers, keyboard,
and cassette player. Settings alternated order, calls were sequential with at least
six seconds between starts, and the same prompt and 4,096-token output/thinking
budget were used. A second round was partially completed. No automatic retries.
These are local calls through the actual pricing handler, not phone/Supabase timings.

| Photo | Low estimates (PHP) | Medium estimates (PHP) |
| --- | --- | --- |
| Jacket | 650; 600 | provider error; 500 |
| Instant camera | 3,000; 3,500 | 3,500; quota error |
| Sneakers | 1,800 | 2,000 |
| Keyboard | provider error | 2,800 |
| Cassette player | 5,000 | 8,000 |

Low was faster in this small run. Both settings had a provider availability error;
medium also encountered the quota limit, which should not be attributed to reasoning
quality. Price estimates vary, including between repeats. There are no verified sold
prices, so these results cannot determine pricing accuracy or which setting gives a
better valuation. The small bundled photos also do not represent full phone uploads.

No deployment or production configuration was changed by this benchmark. After reviewing
the results, the user selected **3.6 Flash with medium reasoning** for deployment.

Full results: [JSON report](gemini-3.6-2026-10-18T11-13-09-644Z.json).

To run another comparison when quota is available:

```powershell
node --experimental-strip-types Backend/scripts/benchmark-pricing.mjs
```

This makes up to 20 real provider calls using the local key, stops on quota errors,
and saves a new timestamped report. It never prints the key or image bytes.
