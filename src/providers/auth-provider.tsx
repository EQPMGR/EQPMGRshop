
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
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toAppUser(user: User | null): AppUser | null {
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email ?? null,
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
      setOnboardingComplete(data.onboarding_complete || false);
      setShopName(data.shop_name || null);
    } else {
      setOnboardingComplete(false);
      setShopName(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let unsubscribeAuth: (() => void) | null = null;
    let unsubscribeRealtimeChannel: any = null;

    const cleanupRealtime = () => {
      if (unsubscribeRealtimeChannel) {
        unsubscribeRealtimeChannel.unsubscribe();
        unsubscribeRealtimeChannel = null;
      }
    };

    const handleAuthState = async (event: string, session: any) => {
      cleanupRealtime();
      const nextUser = toAppUser(session?.user ?? null);
      setUser(nextUser);

      if (!nextUser) {
        setOnboardingComplete(false);
        setShopName(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // Check if user doc exists and create if not
        const { data: existingUser } = await db
          .from('service_providers')
          .select('*')
          .eq('id', nextUser.uid)
          .single();

        if (!existingUser) {
          await db
            .from('service_providers')
            .insert([{
              id: nextUser.uid,
              email: nextUser.email,
              created_at: new Date().toISOString(),
              onboarding_complete: false,
            }]);
        }

        // Fetch current data
        const { data: userData, error: fetchError } = await db
          .from('service_providers')
          .select('*')
          .eq('id', nextUser.uid)
          .single();

        if (!fetchError && userData) {
          handleUserDocSnapshot(userData);
        } else {
          handleUserDocSnapshot(null);
        }

        // Subscribe to real-time updates
        unsubscribeRealtimeChannel = db
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
        console.warn('AuthProvider user document load failed:', error);
        setOnboardingComplete(false);
        setShopName(null);
        setLoading(false);
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
