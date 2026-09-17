# SnapWorth Web

This package is the web-first Expo Router shell and browser deployment target. Route files under the future `app/` tree will own URL parsing, route parameters, guards, and shell placement only; product UI and behavior come from `@snapworth/shared`.

The required URLs are `/`, `/login`, `/signup`, `/reset-password`, `/onboarding`, `/capture`, `/item/[id]`, `/history`, `/feed`, `/post/[id]`, `/list/[id]`, `/marketplace`, `/listing/[id]`, `/chat`, `/chat/[id]`, and `/admin/review`.

Route modules must not import services, repositories, Supabase, or provider adapters. Expo Router scaffolding and route-neutral placeholder views are added by task 1.3.
