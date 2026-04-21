import { type NextRequest, NextResponse } from 'next/server';
import { supabaseUser } from '@/shared/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await supabaseUser();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/', request.url));
}
