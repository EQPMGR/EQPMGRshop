/**
 * Minimal Supabase storage compatibility helpers for Firebase-style storage calls.
 */

import { auth, supabaseClient } from '@/lib/firebase';

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET;

if (!STORAGE_BUCKET) {
  throw new Error('NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET is required and must be set to an existing Supabase storage bucket.');
}

type StorageRef = {
  path: string;
};

export function ref(storage: unknown, path: string): StorageRef {
  return { path };
}

async function getAuthToken(): Promise<string> {
  let sessionResult = await auth.getSession();
  let token = sessionResult?.data?.session?.access_token;

  if (!token) {
    const refreshResult = await auth.refreshSession();
    if (refreshResult.error) {
      throw new Error('Unable to refresh Supabase auth session. Please sign in again.');
    }
    token = refreshResult?.data?.session?.access_token;
  }

  if (!token) {
    throw new Error('Unable to upload file: no authenticated Supabase session is available. Please sign in and try again.');
  }

  return token;
}

async function uploadToServer(token: string, path: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', path);

  const response = await fetch('/api/upload-logo', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `Failed to upload file to Supabase storage bucket '${STORAGE_BUCKET}'.`);
  }
}

export async function uploadBytes(storageRef: StorageRef, file: File | Blob): Promise<void> {
  if (!(file instanceof File)) {
    throw new Error('Only File uploads are supported.');
  }

  const path = storageRef.path.replace(/^\/+/, '');
  let token = await getAuthToken();

  try {
    await uploadToServer(token, path, file);
  } catch (error: any) {
    const message = error?.message?.toString() ?? '';
    if (message.includes('Invalid or expired auth token') || message.includes('auth token is invalid') || message.includes('auth token has expired')) {
      const refreshResult = await auth.refreshSession();
      if (refreshResult.error) {
        throw new Error('Unable to refresh Supabase auth session. Please sign in again.');
      }
      token = refreshResult?.data?.session?.access_token;
      if (!token) {
        throw new Error('Unable to refresh Supabase auth session. Please sign in again.');
      }
      await uploadToServer(token, path, file);
      return;
    }
    throw error;
  }
}

export async function getDownloadURL(storageRef: StorageRef): Promise<string> {
  const { data } = await auth.storage.from(STORAGE_BUCKET).getPublicUrl(storageRef.path);

  if (!data?.publicUrl) {
    throw new Error('Failed to get download URL: no public URL returned.');
  }

  return data.publicUrl;
}
