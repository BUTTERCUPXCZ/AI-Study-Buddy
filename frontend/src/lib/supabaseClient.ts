// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

// Create Supabase client with custom storage key to avoid conflicts.
//
// flowType: 'implicit' — required so email-confirm links return the
// access_token in the URL hash (`#access_token=…&type=signup`) instead
// of the PKCE `?code=…` exchange. PKCE depends on a `code_verifier`
// stored in localStorage at signUp time; if the user opens the email
// link in a different tab/browser or cleared storage, that exchange
// fails silently and emailVerified never flips. Implicit flow does not
// have that constraint — the hash itself proves the email click.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
      storage: window.localStorage,
      storageKey: 'supabase-auth', // Use a specific key to avoid conflicts
    }
  }
)
