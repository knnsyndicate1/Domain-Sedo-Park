import { createClient } from '@supabase/supabase-js'

// Log environment variable presence (not values) for debugging
const supabaseUrlExists = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKeyExists = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log(`Supabase config check - URL exists: ${supabaseUrlExists}, ANON_KEY exists: ${supabaseKeyExists}`);

// Get the environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
 
// Create client with detailed options
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
}) 