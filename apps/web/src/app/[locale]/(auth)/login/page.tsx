import { Link } from '@/i18n/routing';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? '/';

  return (
    <div>
      <h1 className="text-display-sm text-heading">Sign in</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Use your work email to access WOW Refund.
      </p>

      <div className="mt-6">
        <LoginForm callbackUrl={callbackUrl} error={params.error} />
      </div>

      <div className="mt-5 text-[12.5px] text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Request access
        </Link>
      </div>
    </div>
  );
}
