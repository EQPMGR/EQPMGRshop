
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const BACKEND_PROVIDER = process.env.NEXT_PUBLIC_BACKEND_PROVIDER || 'supabase';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (BACKEND_PROVIDER !== 'supabase') {
  throw new Error(`Unsupported backend provider: ${BACKEND_PROVIDER}. Set NEXT_PUBLIC_BACKEND_PROVIDER=supabase for this app.`);
}

function sanitizeNodeLocalStorage() {
  if (typeof globalThis !== 'undefined' && typeof globalThis.localStorage === 'object') {
    const storage = globalThis.localStorage as Record<string, unknown>;
    if (
      typeof storage.getItem !== 'function' ||
      typeof storage.setItem !== 'function' ||
      typeof storage.removeItem !== 'function' ||
      typeof storage.clear !== 'function' ||
      typeof storage.key !== 'function'
    ) {
      try {
        delete (globalThis as any).localStorage;
      } catch {
        ;
      }
    }
  }
}

sanitizeNodeLocalStorage();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
}

function createBrowserSupabaseClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

function createServerSupabaseClient(): SupabaseClient {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side Supabase access.');
  }

  const serverStorage = {
    getItem: (_key: string) => null,
    setItem: (_key: string, _value: string) => {},
    removeItem: (_key: string) => {},
    clear: () => {},
    key: (_index: number) => null,
    length: 0,
  };

  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      skipAutoInitialize: true,
      storage: serverStorage,
    },
  });
}

const supabase = typeof window === 'undefined' ? createServerSupabaseClient() : createBrowserSupabaseClient();

export const auth = supabase.auth;
export const db = supabase;
export const storage = supabase.storage;
export const supabaseClient = supabase;

export function getEmailRedirectUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? (typeof window !== 'undefined' ? window.location.origin : undefined);
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_BASE_URL is required for Supabase email redirects.');
  }
  return new URL('/dashboard/settings', baseUrl).toString();
}

