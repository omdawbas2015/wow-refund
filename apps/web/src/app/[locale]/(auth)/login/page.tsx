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
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        Sign in to your account
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Enter your credentials to access the platform
      </p>

      <div className="mt-8">
        <LoginForm callbackUrl={callbackUrl} error={params.error} />
      </div>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
          Request access
        </Link>
      </div>
    </div>
  );
}
