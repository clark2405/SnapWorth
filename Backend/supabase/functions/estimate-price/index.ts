import { createEstimateHandler, defaultPricingModel } from "./pricing.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

Deno.serve(
  createEstimateHandler({
    apiKey:
      Deno.env.get("AI_PROVIDER") === "gemini"
        ? (Deno.env.get("AI_API_KEY") ?? "")
        : "",
    model: Deno.env.get("AI_MODEL") ?? defaultPricingModel,
    thinkingLevel: Deno.env.get("AI_THINKING_LEVEL"),
    fetch,
    authenticate: async (token) => {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { apikey: supabaseKey, authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok) throw new Error("Authentication unavailable");
      const user = await response.json();
      return typeof user.id === "string" ? user.id : null;
    },
  }),
);
