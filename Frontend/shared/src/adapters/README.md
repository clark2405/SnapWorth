# Shared Provider Adapters

Pricing and moderation adapters are provider-neutral infrastructure implementations of ports owned by the shared domain. Vendor response shapes are normalized here and never travel into feature views or services.

Browser code calls authenticated backend Edge Functions; provider credentials remain in `Backend/`. Deterministic development adapters support seeded flows, while production composition must reject mock pricing, permit-all moderation, and seeded repositories.
