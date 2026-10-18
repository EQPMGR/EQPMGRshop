import { auth } from '@/lib/supabase';

/** The signed-in user's Supabase access token, to send to server actions and API routes. */
export async function getAccessToken(): Promise<string> {
  const { data } = await auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You must be signed in to do that.');
  return token;
}
