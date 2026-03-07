import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

// Для API Route Handlers (App Router) - с request object
export async function createRouteHandlerClientFromRequest(request: NextRequest) {
  // Используем cookies() из next/headers, так как они синхронизированы с request cookies
  const cookieStore = await cookies();
  
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          // Возвращаем все cookies из cookieStore
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            // Устанавливаем cookies через cookieStore
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as any);
            });
          } catch (error) {
            // В API routes cookies устанавливаются через Response headers
            // Игнорируем ошибки установки cookies здесь
            console.warn("Could not set cookies in API route:", error);
          }
        },
      },
    }
  );
}

// Для Server Components и API Routes (без request)
export async function createRouteHandlerClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as any)
            );
          } catch {
            // Ignore - cookies can't be set in Server Components
          }
        },
      },
    }
  );
}
