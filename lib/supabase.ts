import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
export const isSupabaseTestMode =
  isSupabaseConfigured &&
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_SUPABASE_TEST_MODE === "true";

let browserClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Add the project URL and publishable key.");
  }
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}
