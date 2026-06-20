import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Chybí SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY v prostředí.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
