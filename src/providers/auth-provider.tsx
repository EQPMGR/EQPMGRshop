
'use client';

import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { auth, db, getEmailRedirectUrl } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface AppUser {
  uid: string;
  email: string | null;
  emailVerified?: boolean;
  displayName?: string | null;
  photoURL?: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  signup: (email: string, pass: string, name: string) => Promise<any>;
  logout: () => void;
  onboardingComplete: boolean;
  shopName: string | null;
  /** Called by the onboarding page once the shop's details are saved. */
  markOnboarded: (shopName: string) => void;
}

/**
 * A shop is set up once its service_providers row has a name and a city
 * (written by /onboarding). app_users.onboarding_complete isn't used: that row
 * is shared with the rider app, which can reset it.
 */
function isShopSetUp(row: any): boolean {
  return !!(row && row.shop_name && row.city);
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toAppUser(user: User | null): AppUser | null {
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email ?? null,
    // Without this the onboarding guard never ran, so new shops skipped setup.
    emailVerified: !!user.email_confirmed_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean>(false);
  const [shopName, setShopName] = useState<string | null>(null);
  const router = useRouter();

  const handleUserDocSnapshot = useCallback((data: any) => {
    if (data) {
      setOnboardingComplete(isShopSetUp(data));
      setShopName(data.shop_name || null);
    } else {
      setOnboardingComplete(false);
      setShopName(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let unsubscribeAuth: (() => void) | null = null;
    let realtimeChannel: any = null;
    // Supabase reports the session more than once on page load (getSession and
    // INITIAL_SESSION). Only the latest run may apply its results.
    let run = 0;
    let currentUid: string | null = null;

    const cleanupRealtime = () => {
      if (realtimeChannel) {
        // removeChannel (not just unsubscribe) so a new channel with the same
        // name can be created; reusing a subscribed one throws.
        db.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
    };

    const handleAuthState = async (event: string, session: any) => {
      const nextUser = toAppUser(session?.user ?? null);

      // Same shop reported again (duplicate page-load event, token refresh,
      // tab refocus): keep everything, no reload and no loading flash.
      if (nextUser && nextUser.uid === currentUid) {
        setUser(nextUser);
        return;
      }

      const myRun = ++run;
      cleanupRealtime();
      currentUid = nextUser?.uid ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setOnboardingComplete(false);
        setShopName(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      // The shop row is created by /onboarding; until then there is none.
      const { data: userData, error: fetchError } = await db
        .from('service_providers')
        .select('*')
        .eq('id', nextUser.uid)
        .maybeSingle();
      if (myRun !== run) return; // a newer run took over
      if (fetchError) console.warn('AuthProvider shop load failed:', fetchError.message);
      handleUserDocSnapshot(fetchError ? null : userData);

      // Live updates to the shop row (e.g. after onboarding saves it).
      try {
        realtimeChannel = db
          .channel(`service-providers:${nextUser.uid}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'service_providers',
              filter: `id=eq.${nextUser.uid}`,
            },
            (payload: any) => {
              if (payload.new) {
                handleUserDocSnapshot(payload.new);
              }
            }
          )
          .subscribe();
      } catch (error: any) {
        // Live updates are a nice-to-have; never let them reset the shop's state.
        console.warn('AuthProvider live updates failed:', error?.message);
      }
    };

    auth.getSession().then(({ data }) => {
      handleAuthState('INITIAL_SESSION', data.session);
    }).catch((error) => {
      console.warn('Supabase getSession failed:', error);
      setLoading(false);
    });

    const authStateChange = auth.onAuthStateChange((event, session) => {
      handleAuthState(event, session);
    });

    if (authStateChange?.data?.subscription?.unsubscribe) {
      unsubscribeAuth = authStateChange.data.subscription.unsubscribe;
    }

    return () => {
      cleanupRealtime();
      if (unsubscribeAuth) {
        unsubscribeAuth();
      }
    };
  }, [handleUserDocSnapshot]);

  const login = async (email: string, pass: string) => {
    const { error, data } = await auth.signInWithPassword({ email, password: pass });
    if (error) {
      throw error;
    }
    return data;
  };

  const signup = async (email: string, pass: string, shopName: string) => {
    const { error, data } = await auth.signUp({
      email,
      password: pass,
      options: {
        emailRedirectTo: getEmailRedirectUrl(),
      },
    });

    if (error) {
      throw error;
    }

    const newUser = data.user;
    if (newUser && data.session) {
      const userData = {
        id: newUser.id,
        email: newUser.email ?? null,
        shop_name: shopName,
        created_at: new Date().toISOString(),
        onboarding_complete: false,
      };
      
      // Insert into both tables
      await db
        .from('service_providers')
        .insert([userData]);

      await db
        .from('app_users')
        .insert([{
          id: newUser.id,
          email: newUser.email,
          created_at: new Date().toISOString(),
        }]);

      setOnboardingComplete(false);
      setShopName(shopName);
    } else if (newUser) {
      setOnboardingComplete(false);
      setShopName(shopName);
    }

    return data;
  };

  const logout = async () => {
    const { error } = await auth.signOut();
    if (error) {
      console.warn('Supabase signOut error:', error);
    }
    router.push('/');
  };

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    onboardingComplete,
    shopName,
    markOnboarded: (name: string) => {
      setOnboardingComplete(true);
      setShopName(name);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
