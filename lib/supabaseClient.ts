import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://oshymujvzarneiersmck.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zaHltdWp2emFybmVpZXJzbWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMTczNDIsImV4cCI6MjEwNzc5MzM0Mn0.pEjmoPYcXADLzIc4_S7-yncEb96xBOJXJn0leCQtApY';

export const getSupabaseUrl = (): string =>
  process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;

export const getSupabaseAnonKey = (): string =>
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = (): boolean => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return Boolean(
    url &&
    key &&
    url.startsWith('http') &&
    !url.includes('your-project')
  );
};

let clientInstance: SupabaseClient | null = null;

/**
 * Browser singleton. There must be exactly ONE auth-persisting client per
 * browser context: multiple GoTrueClient instances share the same session
 * storage key and race on refresh-token rotation, which can wipe the session
 * and make subsequent DB requests go out as `anon` (RLS 42501 / HTTP 401).
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return clientInstance;
}

/**
 * Server-only: creates a short-lived client for ONE request, bound to the
 * caller's Supabase JWT. Every PostgREST call carries `Authorization: Bearer <jwt>`,
 * so Postgres RLS evaluates auth.uid() as the authenticated user.
 * Never share this client across requests.
 */
export function createSupabaseClientForToken(accessToken: string): SupabaseClient | null {
  if (!isSupabaseConfigured() || !accessToken) return null;
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

/**
 * Server-only: authenticates an API request from its Bearer token.
 * Returns the verified Supabase user and a JWT-bound client, or null.
 */
export async function authenticateApiRequest(
  request: Request
): Promise<{ user: User; client: SupabaseClient } | null> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const client = createSupabaseClientForToken(token);
  if (!client) return null;

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return { user, client };
}

/**
 * Returns current authenticated Supabase user or null.
 * Uses supabase.auth.getUser() as the canonical verification,
 * with getSession() fallback for offline/instant hydration.
 */
export async function getCurrentSupabaseUser(): Promise<User | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    // 1. Check active session first (fastest, immediately available from local storage or URL hash)
    const { data: { session }, error: sessionError } = await client.auth.getSession();
    if (!sessionError && session?.user) {
      return session.user;
    }

    // 2. Fall back to remote getUser() verification
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (!userError && user) {
      return user;
    }

    return null;
  } catch (err) {
    console.warn('[Supabase] Failed getting authenticated user:', err);
    return null;
  }
}

/**
 * Returns current Supabase JWT access token for API Authorization header
 */
export async function getSupabaseAccessToken(): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) return null;
    return session.access_token || null;
  } catch (err) {
    console.warn('[Supabase] Failed getting access token:', err);
    return null;
  }
}

/**
 * Resolves the canonical site URL for authentication redirects:
 * - Checks NEXT_PUBLIC_SITE_URL if configured with a non-localhost URL (e.g., custom domain or LAN IP)
 * - Checks NEXT_PUBLIC_VERCEL_URL for automated preview / production deployments
 * - In client-side runtime, uses window.location.origin (unless localhost and explicit NEXT_PUBLIC_SITE_URL is given)
 * - Defaults to 'http://localhost:3000' in development and 'https://linkedindm.vercel.app' in production
 */
export function getSiteUrl(): string {
  // If explicitly configured with a non-localhost URL (e.g., Vercel, custom domain, or LAN IP like http://192.168.1.7:3000), prioritize it
  if (process.env.NEXT_PUBLIC_SITE_URL && !process.env.NEXT_PUBLIC_SITE_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  }
  // Vercel deployment preview / production environment variable
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL.replace(/\/+$/, '')}`;
  }
  // In client-side runtime, use the actual browser origin if it's not localhost (e.g., LAN IP or tunnel)
  if (typeof window !== 'undefined' && window.location?.origin) {
    if (!window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1')) {
      return window.location.origin;
    }
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.NODE_ENV === 'production'
    ? 'https://linkedindm.vercel.app'
    : 'http://localhost:3000';
}


