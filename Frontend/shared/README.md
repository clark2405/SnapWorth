# SnapWorth Shared

This package owns cross-platform product code reused by the web shell and the future single mobile shell.

The dependency direction is presentation → application state → services → ports and domain types. Components are stateless and token-driven. Seeded data, Supabase repositories, and provider adapters are sibling infrastructure implementations selected only by a shell composition root; they do not leak vendor payloads into product routes.

The planning notes preserved under `src/` document the intended component, feature, service, and adapter responsibilities until their implementation tasks replace them with code.
