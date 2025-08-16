
'use client';

import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  signup: (email: string, pass: string, name: string) => Promise<any>;
  logout: () => void;
  onboardingComplete: boolean;
  shopName: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean>(false);
  const [shopName, setShopName] = useState<string | null>(null);
  const router = useRouter();

  const handleUserDocSnapshot = useCallback((docSnap: any) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      setOnboardingComplete(data.onboardingComplete || false);
      setShopName(data.shopName || null);
    } else {
      // This case handles a new user that doesn't have a doc yet.
      setOnboardingComplete(false);
      setShopName(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        setLoading(true);
        const userDocRef = doc(db, "users", user.uid);
        const unsubscribeFirestore = onSnapshot(userDocRef, handleUserDocSnapshot);
        return () => unsubscribeFirestore(); // Cleanup Firestore listener
      } else {
        // No user, reset state
        setOnboardingComplete(false);
        setShopName(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth(); // Cleanup auth listener
  }, [handleUserDocSnapshot]);

  const login = (email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const signup = async (email: string, pass: string, shopName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const newUser = userCredential.user;

    if (newUser) {
      const userData = {
        uid: newUser.uid,
        email: newUser.email,
        shopName: shopName,
        createdAt: new Date(),
        onboardingComplete: false, // Explicitly set to false on signup
      };
      await setDoc(doc(db, "users", newUser.uid), userData);
      
      // Manually update local state after signup to prevent redirect loop
      setOnboardingComplete(false);
      setShopName(shopName);

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
