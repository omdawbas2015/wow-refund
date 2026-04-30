'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2 } from 'lucide-react';
import { signupAction } from '@/app/actions/auth';

export function SignupForm() {
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await signupAction(fd);
      if (result.ok) {
        setSubmitted(true);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (submitted) {
    return (
      <Alert variant="success">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Request submitted</AlertTitle>
        <AlertDescription>Your access request has been submitted. You will receive an email once approved.</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormField label="Full name" id="name" required>
        <Input id="name" name="name" type="text" autoComplete="name" required disabled={pending} />
      </FormField>

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

      <FormField label="Phone number" id="phone">
        <Input id="phone" name="phone" type="tel" autoComplete="tel" disabled={pending} />
      </FormField>

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? 'Submitting...' : 'Request access'}
      </Button>
    </form>
  );
}
