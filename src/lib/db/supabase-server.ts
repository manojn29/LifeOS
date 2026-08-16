import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://demo-lifeos.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'demo-anon-key';

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}

export async function getAuthenticatedUser() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      // In development / demo mode when not configured, return a default mock user id
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('demo')) {
        return {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'demo@lifeos.local',
          user_metadata: { full_name: 'LifeOS User' }
        };
      }
      return null;
    }
    return user;
  } catch (err) {
    console.error('Error fetching authenticated user:', err);
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('demo')) {
      return {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'demo@lifeos.local',
        user_metadata: { full_name: 'LifeOS User' }
      };
    }
    return null;
  }
}
