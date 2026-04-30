'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

function mapAuthError(err: string | undefined | null): string | null {
  if (!err) return null;
  if (err === 'undefined' || err === 'null') return null;
  if (err.includes('ACCOUNT_PENDING')) return 'Your account is pending approval.';
  if (err.includes('ACCOUNT_SUSPENDED')) return 'Your account has been suspended.';
  if (err.includes('ACCOUNT_LOCKED')) return 'Your account is locked. Try again later.';
  if (err.includes('RATE_LIMITED')) return 'Too many attempts. Please wait a moment and try again.';
  if (err === 'CredentialsSignin' || err.includes('Credentials')) return 'Invalid email or password.';
  if (err === 'Configuration') return 'Authentication is misconfigured. Please contact support.';
  return 'Invalid email or password.';
}

export function LoginForm({ callbackUrl, error: initialError }: { callbackUrl: string; error?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(mapAuthError(initialError));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get('email') ?? '');
    const password = String(fd.get('password') ?? '');

    startTransition(async () => {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(mapAuthError(result.error));
        return;
      }

      toast.success('Signed in successfully');
      router.push(callbackUrl);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormField label="Email address" id="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          disabled={pending}
        />
      </FormField>

      <FormField label="Password" id="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </FormField>

      <div className="flex items-center justify-end text-sm">
        <Link href="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  );
}
