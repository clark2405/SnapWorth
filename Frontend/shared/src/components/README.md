# Shared Presentation Components

Components are stateless, reusable React Native views: props in, rendered output out. They perform no fetching, navigation, Supabase access, or provider access.

All visual values come from the shared design tokens. Interactive controls provide visible focus and at least a 44 × 44 target; icon-only controls have accessible labels; status and choice never rely on color alone; font scaling remains enabled.

`EstimateBadge` and `AskingPriceBadge` remain separate exports. `EstimateBadge` always includes `AI ESTIMATE`, the provisional dashed treatment, and `Estimate only — not a listing price.` Asking prices use only the settled `AskingPriceBadge` treatment.
