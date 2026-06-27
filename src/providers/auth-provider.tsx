
'use client';

import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { auth, db, getEmailRedirectUrl } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { doc, setDoc, getDoc, onSnapshot } from '@/lib/firestore-compat';

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

  const handleUserDocSnapshot = useCallback((docSnap: any) => {
    if (docSnap?.exists) {
      const data = docSnap.data();
      setOnboardingComplete(data.onboardingComplete || false);
      setShopName(data.shopName || null);
    } else {
      setOnboardingComplete(false);
      setShopName(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let unsubscribeAuth: (() => void) | null = null;
    let unsubscribeFirestore: (() => void) | null = null;

    const cleanupFirestore = () => {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }
    };

    const handleAuthState = async (event: string, session: any) => {
      cleanupFirestore();
      const nextUser = toAppUser(session?.user ?? null);
      setUser(nextUser);

      if (!nextUser) {
        setOnboardingComplete(false);
        setShopName(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const userDocRef = doc(db, 'users', nextUser.uid);

      try {
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists) {
          await setDoc(db, userDocRef, {
            email: nextUser.email,
            createdAt: new Date(),
            onboardingComplete: false,
          });
        }

        unsubscribeFirestore = onSnapshot(db, userDocRef, handleUserDocSnapshot, (error) => {
          console.warn('Firestore compatibility snapshot error:', error);
          setLoading(false);
        });
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
      cleanupFirestore();
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
        email: newUser.email ?? null,
        shopName,
        createdAt: new Date(),
        onboardingComplete: false,
      };
      await setDoc(db, doc(db, 'users', newUser.id), userData);
      await setDoc(db, doc(db, 'serviceProviders', newUser.id), {
        ownerId: newUser.id,
        shopName,
      }, { merge: true });
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
