import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using service role key (bypasses RLS).
// This file must NEVER be imported from client components.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
