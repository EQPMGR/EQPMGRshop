'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast"
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to log in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144.28 142.27" className="h-24 w-24">
              <defs><style>{`.cls-1{fill:hsl(var(--primary));}.cls-2{fill:hsl(var(--accent));}`}</style></defs>
              <g id="Layer_2" data-name="Layer 2">
                <g id="Layer_1-2" data-name="Layer 1">
                  <path className="cls-1" d="M132.21,86.66c6.29-3,10.22-8.29,10.22-15.85v-.14c0-5.34-1.63-9.19-4.74-12.3-3.63-3.63-9.48-5.92-18.66-5.92h-8V38.88h7.46c14,0,23.56-6.66,23.56-19.18v-.15c0-12.29-9.41-18.44-23.18-18.44H93.7V17.78C89.9,7.34,79.66,0,67.07,0A29,29,0,0,0,47.56,7.27V1.11H.28V104.29H17.66V78.59l7.62,10.48h.31l7.62-10.48v25.7H50.89V93.87c5.2,7.22,14.11,11.53,24.3,11.53a37,37,0,0,0,18.51-4.77v3.66H111V89.48h3.7l9.78,14.81h19.77ZM111,15h6.58c4.59,0,7.33,1.93,7.33,5.7v.15c0,3.7-3,5.7-7.41,5.7H111ZM93.7,53v4.16a30.94,30.94,0,0,0-4.78-2.76L93.7,49V53ZM93.7,36v8.43l-3-2.54A26.56,26.56,0,0,0,93.7,36Zm-5.44,18A32,32,0,0,0,79,51.59a30.47,30.47,0,0,0,4.11-2.19ZM56.19,27.18c0-6.07,4.15-11.85,10.74-11.85s11,5.78,11,11.92v.15a15,15,0,0,1-.37,3.11l-5.55-5-7.26,8.14,5.85,5a11.21,11.21,0,0,1-3.56.59c-6.73,0-10.88-5.78-10.88-11.92ZM17.31,15.33H41.42a26.21,26.21,0,0,0-1.92,5.26H17.31Zm0,17.77H39.37a26.26,26.26,0,0,0,2,5.63h-24ZM19.13,53H32L25.59,62.7Zm31.76,10V52.45h-3V47.26a28.44,28.44,0,0,0,14.51,6.48A26.84,26.84,0,0,0,50.89,62.91Zm31,21.83v5.18a11.49,11.49,0,0,1-5.93,1.19c-7.25,0-12.36-5-12.36-12.37v-.15c0-7,4.88-12.22,11.62-12.22a17.39,17.39,0,0,1,11.48,4.52l7-8.48V73.63H73V84.74Zm43.31-12.67c0,3.19-2.51,5-6.66,5H111V67h7.55c4,0,6.59,1.63,6.59,5Z"/>
                  <path class="cls-2" d="M0,136.35,6.17,129a19.79,19.79,0,0,0,12.08,4c2.08,0,3-.54,3-1.48v-.09c0-1-1.08-1.53-4.78-2.27-7.75-1.58-14.56-3.8-14.56-11.11V118c0-6.57,5.14-11.65,14.66-11.65,6.66,0,11.59,1.58,15.59,4.74l-5.63,7.79a18.14,18.14,0,0,0-10.36-3.4c-1.72,0-2.51.59-2.51,1.43v.1c0,.94.93,1.53,4.59,2.22C27,120.86,33,123.42,33,130.38v.1c0,7.25-6,11.69-15.25,11.69C10.71,142.17,4.39,140.2,0,136.35Z"/>
                  <path class="cls-2" d="M35.63,107H47.17v12.19H57.73V107H69.27v34.54H57.73V129.15H47.17v12.38H35.63Z"/>
                  <path class="cls-2" d="M72.44,124.36v-.1c0-10,8.24-18,18.89-18s18.8,7.9,18.8,17.91v.1c0,10-8.24,18-18.89,18S72.44,134.38,72.44,124.36Zm26.05,0v-.1c0-4.09-2.81-7.79-7.25-7.79s-7.16,3.65-7.16,7.69v.1c0,4.1,2.81,7.8,7.25,7.8S98.49,128.41,98.49,124.36Z"/>
                  <path class="cls-2" d="M113.3,107h15.54c9.17,0,15.44,4.1,15.44,12.29v.1c0,8.34-6.36,12.78-15.69,12.78h-3.75v9.37H113.3ZM128,123.92c3,0,4.93-1.34,4.93-3.8V120c0-2.52-1.82-3.8-4.88-3.8h-3.16v7.7Z"/>
                </g>
              </g>
            </svg>
          </div>
          <CardDescription>Welcome back! Please login to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Don't have an account?{' '}
            <Link href="/signup" className="underline text-accent">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
