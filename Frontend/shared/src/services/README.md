# Shared Domain Services

Services own product invariants and use cases. They initiate outward work only through inward-owned ports and domain types; they never import concrete Supabase repositories or provider adapters.

Core invariants include durable item and photo storage before automatic estimation, separate AI-estimate and seller asking-price semantics, fail-closed public moderation, one active vote per user and post, and authorization-safe deferred Chat and Admin seams.
