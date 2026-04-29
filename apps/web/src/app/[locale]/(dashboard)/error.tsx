'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Dashboard-scoped error boundary. Renders inside the authenticated shell
 * so the sidebar / top bar stay mounted — the user can navigate away from
 * the broken route without a full page reload.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DashboardError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-heading-md text-heading">This page hit an error</h1>
        <p className="text-sm text-muted-foreground">
          The dashboard is still working — this one page couldn't render. Retry, or use the sidebar to move on.
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
            <Link href="/">Dashboard home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
