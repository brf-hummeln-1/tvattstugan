import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY saknas i miljön')
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // Sessionen sparas i localStorage och förnyas automatiskt, så man loggar
    // i praktiken bara in en gång per enhet.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
