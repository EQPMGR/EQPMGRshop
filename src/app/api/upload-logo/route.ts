import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET;

const serverStorage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
  clear: () => {},
  key: (_index: number) => null,
  length: 0,
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !STORAGE_BUCKET) {
  throw new Error('Missing Supabase storage or auth configuration for server upload route.');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    skipAutoInitialize: true,
    storage: serverStorage,
  },
});

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!accessToken) {
    return NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Invalid or expired auth token.' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const storagePath = formData.get('path')?.toString() ?? '';

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file was provided.' }, { status: 400 });
  }

  const normalizedPath = storagePath.replace(/^\/+/, '');
  const expectedPrefix = `logos/${userData.user.id}/`;
  if (!normalizedPath.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: 'Upload path is not allowed.' }, { status: 403 });
  }

  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(normalizedPath, file, { upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicData } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(normalizedPath);
  const publicUrl = publicData?.publicUrl;
  if (!publicUrl) {
    return NextResponse.json({ error: 'Failed to resolve public download URL.' }, { status: 500 });
  }

  return NextResponse.json({ url: publicUrl });
}
