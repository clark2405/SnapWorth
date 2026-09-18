# SnapWorth Backend

`Backend/` is the single shared backend for SnapWorth's web application, future Android application, and future iOS application. All clients use this backend rather than platform-specific backend implementations.

The backend will own Supabase Auth, PostgreSQL schema and Row Level Security (RLS), Storage, Realtime, and Edge Functions. External provider secrets and pricing or moderation rate limits remain server-side and must never be included in client applications.

## Canonical directory map

```text
Backend/
├── README.md
├── scripts/
│   └── .gitkeep
└── supabase/
    ├── migrations/
    │   └── .gitkeep
    ├── seed/
    │   └── .gitkeep
    ├── tests/
    │   └── .gitkeep
    └── functions/
        ├── _shared/
        │   └── providers/
        │       └── .gitkeep
        ├── estimate-price/
        │   └── .gitkeep
        └── moderate-content/
            └── .gitkeep
```

This directory is an implementation scaffold only. Backend implementation code will be added in later tasks.
