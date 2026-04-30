import { type ReactNode } from 'react';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-12 items-center px-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-900 text-[11px] font-bold text-white">
            W
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-heading">
            WOW Refund
          </span>
        </div>
      </header>

      {/* Form */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[360px]">{children}</div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-[11.5px] text-muted-foreground">
        &copy; {new Date().getFullYear()} WOW Refund
      </footer>
    </div>
  );
}
