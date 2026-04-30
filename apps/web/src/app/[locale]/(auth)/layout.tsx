import { type ReactNode } from 'react';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-14 items-center px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-2xl surface-butter text-[13px] font-bold tracking-tight">
            W
          </div>
          <span className="text-[13.5px] font-semibold tracking-tight text-heading">
            WOW Refund
          </span>
        </div>
      </header>

      {/* Form */}
      <main className="flex flex-1 items-center justify-center px-6 py-8">
        <div className="w-full max-w-[380px] rounded-3xl border border-border bg-surface p-7">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-[11.5px] text-muted-foreground">
        &copy; {new Date().getFullYear()} WOW Refund
      </footer>
    </div>
  );
}
