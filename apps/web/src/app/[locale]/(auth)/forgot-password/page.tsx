import { Link } from '@/i18n/routing';
import { ForgotPasswordForm } from './forgot-password-form';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        Reset your password
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Enter your email and we&apos;ll send you a reset code
      </p>
      <div className="mt-8">
        <ForgotPasswordForm defaultEmail={params.email ?? ''} />
      </div>
      <div className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
