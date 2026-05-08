import Image from 'next/image';
import { type ReactNode } from 'react';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-14 items-center px-6">
        <div className="flex items-center gap-2.5">
          <Image
            src="/brand/alshaya-mark.png"
            alt="Alshaya"
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
          />
          <span className="text-[13px] font-semibold tracking-tight text-heading">
            Alshaya Refund
          </span>
        </div>
      </header>

      {/* Form */}
      <main className="flex flex-1 items-center justify-center px-6 py-8">
        <div className="w-full max-w-[380px] rounded-3xl border border-border bg-surface p-7">
          <div className="mb-6 flex justify-center">
            <Image
              src="/brand/alshaya-group.png"
              alt="Alshaya Group"
              width={140}
              height={140}
              className="h-auto w-[140px] object-contain"
              priority
            />
          </div>
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-[11px] text-muted-foreground">
        &copy; {new Date().getFullYear()} Alshaya Group — Refund Operations
      </footer>
    </div>
  );
}
