# SnapWorth: camera AI estimation only

## Goal

Take a photo and get a real rough price estimate from Gemini in Philippine pesos.
Keep the existing login-first screens, with their current demo session behavior.
Full email authentication, History, feed posting, and marketplace are deferred.

## Flow

1. Start at login (or the first-run introduction), then open the camera after login.
2. Take a photo and show it while estimation runs automatically.
3. Send the image to a Supabase Edge Function. The Gemini key stays there.
4. Return the item name, estimated PHP value, low-to-high range, and explanation.
5. Offer Retake and Retry. Keep the photo available if estimation fails.

## Minimal backend access

Use an automatic Supabase anonymous session, without asking the user to sign
in or enter account details. This requires Anonymous Sign-Ins to be enabled in
the project's Authentication settings. Validate its session in the function,
limit requests, and do not expose the Gemini key in the app.

## Rules

Use the Gemini free tier only. Handle quota limits, unclear photos, refusal,
timeouts, and invalid responses honestly. Validate numbers and ranges, and
label results as rough estimates without verified current comparable sales.
The photo is processed for the estimate; this version does not promise saved
History. Explain third-party photo processing before first submission and use
non-sensitive test photos during development.

## What is confirmed

The camera works. A live request using the saved Gemini key and a repository
sample photo successfully returned an estimate from gemini-3.8-flash, then
gemini-3.5-flash-lite with minimal reasoning for faster responses. This
confirms API access and image analysis, not pricing accuracy or the complete
in-app flow. Remote anonymous sessions are enabled and verified.

## Checks

Test photo submission, displayed real results, retry, quota failures,
authentication, size limits, and duplicate taps. Run frontend and backend
checks, then verify on the phone.

Status: estimate-price is deployed. A live anonymous-session sample-photo request returned HTTP 200 and a validated Gemini estimate. Physical-phone testing remains.

Speed tuning: the deployed Flash-Lite request returned HTTP 200 in 2,957 ms on
2026-10-18, versus 60,835 ms in the earlier Flash test. Output remains validated
and includes a PHP range and uncertainty notes. Timing varies with provider load
and network conditions; this sample does not establish estimate accuracy.

The user's later priority is more careful identification with roughly 10–15 seconds of latency.
The current deployed default is Gemini 3.6 Flash with medium reasoning and a 4,096-token
shared reasoning/output budget. AI_THINKING_LEVEL can tune reasoning on the server.
The prompt examines visible labels, distinguishing features, condition and completeness;
it requests missing details when identification is essential and uncertain. A live deployed
sample request returned HTTP 200 in 10,496 ms. Eleven handler tests pass. No comparison
against known sold prices has been performed, so improved pricing accuracy is not established.

Latest requested comparison: Gemini 3.7 Flash/medium returned a validated estimate in 8,586 ms
through Supabase, under the user's 20-second selection cutoff, so the deployed default is
now 3.7 with medium reasoning. Camera provider/processing notice text was removed at the
user's request. Existing backend documentation still describes external image processing.

Reliability retest supersedes the earlier model selection: 3.7/medium timed out at 60 seconds
through Supabase and took 49 seconds directly. 3.6/medium failed with provider 503 UNAVAILABLE.
The deployed default is now Gemini 3.5 Flash-Lite/medium, retaining the more careful prompt
and 4,096-token budget. Local tests returned estimates in 1.56 seconds (low) and 3.76 seconds
(medium). Two deployed medium checks returned HTTP 200 and validated estimates in 4,842 ms
and 3,402 ms. This supports choosing the working configuration now, not a future latency
guarantee or a demonstrated accuracy improvement. Eleven backend tests pass.

Final user selection for this commit: Gemini 3.6 Flash with medium reasoning.
The code default and explicit deployed AI_MODEL/AI_THINKING_LEVEL settings use that
configuration. Benchmark findings about quota/provider errors remain applicable;
the user chose this setting after reviewing them. History and posting remain deferred.
Deployment and explicit server settings succeeded. The final live check returned
HTTP 429 rate_limited, so successful estimation remains blocked by provider quota.
Pre-commit review also fixed iOS capture readiness after resolution selection;
iOS emits one ready event while Android reports readiness after reconfiguration.
