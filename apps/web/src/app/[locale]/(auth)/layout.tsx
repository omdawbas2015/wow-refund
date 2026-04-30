import { type ReactNode } from 'react';
import { Zap } from 'lucide-react';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-[45%] lg:flex-col lg:justify-between bg-[hsl(224,71%,4%)] p-10 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold">WOW Refund</span>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Streamline your refund operations
          </h1>
          <p className="mt-3 text-base text-white/60 leading-relaxed">
            Manage refund cases, track approvals, and process payments efficiently
            with a modern operations platform.
          </p>
        </div>

        <p className="text-xs text-white/30">
          &copy; {new Date().getFullYear()} WOW Refund
        </p>
      </div>

      {/* Right panel - form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-10 bg-white">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-foreground">WOW Refund</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
