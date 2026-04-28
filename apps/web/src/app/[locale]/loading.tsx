import { Loader2 } from 'lucide-react';

/**
 * Top-level Suspense fallback for every locale-scoped page. Keeps the
 * transition quiet: no layout shift, no flash of untranslated shell. Child
 * routes (like `(dashboard)/loading.tsx`) can override this for a more
 * page-specific skeleton.
 */
export default function LocaleLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[50vh] items-center justify-center text-muted-foreground"
    >
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
