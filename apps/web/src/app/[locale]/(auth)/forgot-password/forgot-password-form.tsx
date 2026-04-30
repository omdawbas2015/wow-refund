'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2 } from 'lucide-react';
import { forgotPasswordRequestAction, forgotPasswordVerifyAction } from '@/app/actions/auth';

export function ForgotPasswordForm({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState(defaultEmail);

  function requestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await forgotPasswordRequestAction(fd);
      if (result.ok) {
        setEmail(String(fd.get('email')));
        setStage('verify');
        toast.success('A reset code has been sent to your email.');
      } else {
        toast.error(result.error);
      }
    });
  }

  function verifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('email', email);
    startTransition(async () => {
      const result = await forgotPasswordVerifyAction(fd);
      if (result.ok) {
        toast.success('Password reset successfully.');
        router.push('/login');
      } else {
        toast.error(result.error);
      }
    });
  }

  if (stage === 'request') {
    return (
      <form onSubmit={requestCode} className="space-y-5">
        <FormField label="Email address" id="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={defaultEmail}
            required
            disabled={pending}
          />
        </FormField>

        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? 'Sending...' : 'Send reset code'}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="space-y-5">
      <Alert variant="info">
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>A reset code has been sent to your email.</AlertDescription>
      </Alert>

      <FormField label="Reset code" id="code" required>
        <Input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoComplete="one-time-code"
          required
          disabled={pending}
          className="text-center text-lg tracking-[0.5em]"
        />
      </FormField>

      <FormField label="New password" id="newPassword" required>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          disabled={pending}
        />
      </FormField>

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? 'Resetting...' : 'Reset password'}
      </Button>
    </form>
  );
}
