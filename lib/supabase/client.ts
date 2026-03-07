import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// Fallback для сборки на Vercel, если env ещё не заданы (Supabase требует непустые строки)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

export function createClientComponentClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export function createServerComponentClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}




