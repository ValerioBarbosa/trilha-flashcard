import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const PUBLIC_SUPABASE_URL = 'https://rslehgcmskalwkwkotbv.supabase.co';
const PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_46xBG7E-MfyTm1CeTjnSaw_VXb74JfA';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL?.trim() || PUBLIC_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  client = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}
