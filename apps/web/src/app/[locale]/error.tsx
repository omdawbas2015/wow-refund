'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Locale-scoped error boundary for unrecoverable render failures. Shows a
 * minimal branded shell so dark mode + RTL still render correctly even when
 * the dashboard chrome couldn't mount. Client-only by requirement of the
 * Next.js error boundary contract.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface in the browser console so front-end errors aren't lost when
    // the user is mid-flow. Sentry picks up the stack via the SDK wrapper.
    console.error('[LocaleError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-heading-lg text-heading">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          An unexpected error interrupted this page. You can retry, or head back to the dashboard.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground">ref: {error.digest}</p>
        ) : null}
        <div className="flex justify-center gap-3">
          <Button onClick={reset} variant="default">
            <RefreshCw className="h-4 w-4" aria-hidden />
            Retry
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
