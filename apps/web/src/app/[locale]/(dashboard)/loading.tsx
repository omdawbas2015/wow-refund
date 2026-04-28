import { Loader2 } from 'lucide-react';

/**
 * Dashboard-scoped Suspense fallback. Keeps the outer Sidebar / TopBar
 * mounted and only greys out the main content area, which is less jarring
 * for route transitions inside the authenticated shell.
 */
export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-full min-h-[40vh] items-center justify-center p-8 text-muted-foreground"
    >
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
