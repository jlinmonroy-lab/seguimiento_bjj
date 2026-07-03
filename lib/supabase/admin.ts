import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

// Admin client uses the service role key — NEVER expose this to the browser.
// Only import this file from Server Actions or Route Handlers.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
