import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/db/supabase-server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/journal';

  // Determine actual client origin from headers (e.g. mobile IP 192.168.1.2:3000)
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const clientOrigin = forwardedHost
    ? `${proto}://${forwardedHost}`
    : host
    ? `${proto}://${host}`
    : origin;

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const isLocalhost = clientOrigin.includes('localhost');
      // If client visited from an IP or custom host, ensure redirect goes to that host
      return NextResponse.redirect(`${clientOrigin}${next}`);
    }
  }

  // Return the user to login with error
  return NextResponse.redirect(`${clientOrigin}/login?error=auth-code-error`);
}
