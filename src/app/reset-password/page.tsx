'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Landing page for the "reset your password" email. Supabase signs the shop in
// from the link (the tokens arrive in the URL), then they choose a new password.

const MIN_LENGTH = 8;

function linkError(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
  const description = params.get('error_description');
  return description ? description.replace(/\+/g, ' ') : null;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (linkError()) {
        setState('invalid');
        return;
      }
      // The sign-in from the link takes a moment to land; wait up to ~5 s.
      for (let i = 0; i < 20 && !cancelled; i++) {
        const { data } = await auth.getSession();
        if (data.session) {
          setState('ready');
          return;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      if (!cancelled) setState('invalid');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await auth.updateUser({ password });
      if (updateError) throw updateError;
      setState('done');
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (e: any) {
      setError(e.message || 'Could not save the new password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-primary">Choose a new password</CardTitle>
          <CardDescription>For your EQPMGR Shop login.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === 'checking' && <p className="text-center text-sm text-muted-foreground">Checking your link…</p>}

          {state === 'invalid' && (
            <>
              <Alert variant="destructive">
                <AlertTitle>This link has expired or was already used</AlertTitle>
                <AlertDescription>Reset links work once and expire after a while. Ask for a new one from the login page.</AlertDescription>
              </Alert>
              <Button asChild variant="secondary" className="w-full">
                <Link href="/">Back to login</Link>
              </Button>
            </>
          )}

          {state === 'done' && (
            <Alert>
              <AlertTitle>Password updated</AlertTitle>
              <AlertDescription>You&apos;re signed in. Taking you to your dashboard…</AlertDescription>
            </Alert>
          )}

          {state === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <p className="text-xs text-muted-foreground">At least {MIN_LENGTH} characters.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Type it again</Label>
                <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              <Button type="submit" disabled={saving} className="w-full bg-accent hover:bg-accent/90">
                {saving ? 'Saving…' : 'Save new password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
