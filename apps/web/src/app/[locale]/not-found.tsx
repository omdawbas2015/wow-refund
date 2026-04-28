import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Locale-scoped 404. Rendered when `notFound()` is called inside the
 * `[locale]` segment (which covers both dashboard and auth routes).
 */
export default function LocaleNotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Compass className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-heading-lg text-heading">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you're looking for doesn't exist, has moved, or requires a role you don't have.
        </p>
        <Button asChild variant="default">
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
