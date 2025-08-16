
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Loading from '@/app/loading';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, onboardingComplete } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // If not logged in, redirect to login page (unless already on a public page)
    if (!user) {
      if(pathname !== '/' && pathname !== '/signup') {
         router.push('/');
      }
      return;
    }

    // If email is not verified, they should see a message on the success page
    // or be blocked from accessing protected routes. For now, we allow access
    // to the dashboard where a message could be displayed.
    if (!user.emailVerified) {
       // Allow them to stay on /signup page if they just signed up
       if (pathname.startsWith('/dashboard')) {
            // console.log("Redirecting unverified user from dashboard");
            // You might want to redirect to a specific 'verify-email' page
            // For now, we will let them see the dashboard where a message could be shown.
       }
       return;
    }

    // If email is verified but onboarding is not complete, redirect to onboarding page
    if (user.emailVerified && !onboardingComplete && pathname !== '/onboarding') {
        router.push('/onboarding');
        return;
    }

    // If onboarding is complete, but they are trying to access the onboarding page, redirect them to dashboard
    if (user.emailVerified && onboardingComplete && pathname === '/onboarding') {
        router.push('/dashboard');
        return;
    }

  }, [user, loading, onboardingComplete, router, pathname]);

  // Show loading indicator while auth state is being determined
  if (loading) {
    return <Loading />;
  }

  // If user is not logged in and not on a public route, show loading to prevent flashing content
  if (!user && pathname !== '/' && pathname !== '/signup') {
      return <Loading />;
  }
  
  // Prevent flashing of dashboard/onboarding content during redirects
  if (user && user.emailVerified && !onboardingComplete && pathname !== '/onboarding') {
    return <Loading />;
  }
   if (user && user.emailVerified && onboardingComplete && pathname === '/onboarding') {
    return <Loading />;
  }


  return <>{children}</>;
}
