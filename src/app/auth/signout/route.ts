import { type NextRequest, NextResponse } from 'next/server';
import { supabaseUser } from '@/shared/lib/supabase/server';

function requestOrigin(request: NextRequest): string {
  const host = request.headers.get('host') ?? new URL(request.url).host;
  const proto = request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '');
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const supabase = await supabaseUser();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${requestOrigin(request)}/`);
}
