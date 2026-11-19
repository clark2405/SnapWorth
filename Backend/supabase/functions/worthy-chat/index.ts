import { createWorthyHandler, defaultChatModel } from "./worthy.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const geminiEnabled = Deno.env.get("AI_PROVIDER") === "gemini";

Deno.serve(
  createWorthyHandler({
    apiKey: geminiEnabled ? (Deno.env.get("AI_API_KEY") ?? "") : "",
    fallbackApiKey: geminiEnabled ? (Deno.env.get("AI_API_KEY_2") ?? "") : "",
    // Chat has its own model (light and quick); AI_MODEL is the pricing model.
    model: Deno.env.get("AI_CHAT_MODEL") ?? defaultChatModel,
    fetch,
    fallbackModels: Deno.env.get("AI_FALLBACK_MODELS"),
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
