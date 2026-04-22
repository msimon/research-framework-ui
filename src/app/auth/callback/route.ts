import { type NextRequest, NextResponse } from 'next/server';
import { supabaseUser } from '@/shared/lib/supabase/server';

function getSafeRedirectPath(next: string | null): string {
  if (!next) return '/';

  const isValidRelativePath =
    next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') && !next.includes(':');

  return isValidRelativePath ? next : '/';
}

function extractNameFromUserMetadata(metadata: Record<string, unknown>): string | null {
  const nameFields = ['full_name', 'name', 'global_name', 'username'];

  for (const field of nameFields) {
    const value = metadata[field];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  const givenName = metadata.given_name;
  const familyName = metadata.family_name;

  if (typeof givenName === 'string' || typeof familyName === 'string') {
    const parts = [givenName, familyName].filter((p) => typeof p === 'string' && p.trim());
    if (parts.length > 0) {
      return parts.join(' ').trim();
    }
  }

  return null;
}

function requestOrigin(request: NextRequest): string {
  const url = new URL(request.url);
  const host = request.headers.get('host') ?? url.host;
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = requestOrigin(request);
  const code = searchParams.get('code');
  const next = getSafeRedirectPath(searchParams.get('next'));
  const supabase = await supabaseUser();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const metadata = user?.identities?.[0]?.identity_data ?? user?.user_metadata;
      if (metadata) {
        const name = extractNameFromUserMetadata(metadata as Record<string, unknown>);
        if (name && !user?.user_metadata?.name) {
          await supabase.auth.updateUser({
            data: { name },
          });
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
