// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

// Create Supabase client with custom storage key to avoid conflicts
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      storageKey: 'supabase-auth', // Use a specific key to avoid conflicts
    }
  }
)
