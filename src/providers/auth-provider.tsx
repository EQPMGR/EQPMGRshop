
'use client';

import { createContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  signup: (email: string, pass: string, name: string) => Promise<any>;
  logout: () => void;
  onboardingComplete: boolean | null;
  shopName: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOnboardingComplete(data.onboardingComplete || false);
          setShopName(data.shopName || null);
        } else {
          setOnboardingComplete(false);
          setShopName(null);
        }
      } else {
        setOnboardingComplete(null);
        setShopName(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = (email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const signup = async (email: string, pass: string, shopName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const newUser = userCredential.user;

    if (newUser) {
      await setDoc(doc(db, "users", newUser.uid), {
        uid: newUser.uid,
        email: newUser.email,
        shopName: shopName,
        createdAt: new Date(),
        onboardingComplete: false, // Explicitly set to false on signup
      });
      await sendEmailVerification(newUser);
    }
    
    return userCredential;
  };
  
  const logout = () => {
    signOut(auth).then(() => {
      router.push('/');
    });
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
