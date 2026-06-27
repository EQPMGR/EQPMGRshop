import Link from 'next/link';

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-lg rounded-2xl border bg-background/90 p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-headline text-primary">Verify Your Email</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Check your inbox for the verification link and follow the instructions to activate your account.
          </p>
        </div>
        <div className="space-y-4 text-center">
          <p className="text-base text-foreground">
            If you already clicked the link, you can return to the login page and sign in again.
          </p>
          <Link href="/" className="inline-flex w-full justify-center rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-accent/90">
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}
