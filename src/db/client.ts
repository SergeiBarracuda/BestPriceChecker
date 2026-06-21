import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Chybí SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY v prostředí.");
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
