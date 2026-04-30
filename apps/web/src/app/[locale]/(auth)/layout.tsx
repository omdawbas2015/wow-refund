import { type ReactNode } from 'react';
import { ShieldCheck, Sparkles, Workflow, Zap } from 'lucide-react';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      {/* Soft brand aurora behind everything */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-brand-aurora opacity-90"
      />
      {/* Faint dotted texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dot-subtle opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
      />

      {/* Left panel — branding + value props */}
      <div className="relative hidden flex-col justify-between px-12 py-12 lg:flex lg:w-[52%]">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient shadow-brand-glow ring-1 ring-white/40">
            <Sparkles className="h-5 w-5 text-white drop-shadow-sm" />
          </div>
          <div>
            <span className="block text-[15px] font-semibold tracking-tight text-heading">
              WOW Refund
            </span>
            <span className="block text-[11px] text-muted-foreground">
              Enterprise refund operations
            </span>
          </div>
        </div>

        <div className="max-w-xl animate-fade-in-up">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" />
            New · World-class refund workspace
          </span>
          <h1 className="mt-5 text-5xl font-semibold leading-[1.05] tracking-tight text-heading">
            Streamline every refund —{' '}
            <span className="text-brand-gradient animate-gradient-pan">
              from request to payout.
            </span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-body">
            One workspace for multi-country, multi-brand refund operations.
            Approvals, payments, audit trail — fast and accountable.
          </p>

          <ul className="stagger mt-10 space-y-4">
            <FeaturePill
              icon={Workflow}
              title="End-to-end approvals"
              description="Route, review, and resolve cases in one timeline."
            />
            <FeaturePill
              icon={ShieldCheck}
              title="Bank-grade security"
              description="Audit trail, RBAC, and PII encryption out of the box."
            />
            <FeaturePill
              icon={Zap}
              title="Built for speed"
              description="Sub-second navigation, keyboard-first workflows."
            />
          </ul>
        </div>

        <p className="text-[11px] text-muted-foreground/70">
          &copy; {new Date().getFullYear()} WOW Refund · All rights reserved
        </p>
      </div>

      {/* Right panel — form card */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-scale-in lg:hidden">
          <div className="mb-8 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient shadow-brand-glow">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-heading">
              WOW Refund
            </span>
          </div>
        </div>

        <div className="relative w-full max-w-sm">
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-surface/95 p-8 shadow-xl backdrop-blur-sm animate-scale-in">
            {/* glossy top edge */}
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
            />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturePill({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <li className="group flex items-start gap-3 rounded-xl border border-border/60 bg-surface/70 p-3 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface hover:shadow-md animate-fade-in-up">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-gradient-soft ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-110">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-heading">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </li>
  );
}
