import { Link } from '@/i18n/routing';
import { SignupForm } from './signup-form';

export default async function SignupPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        Request access
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Submit your details and an admin will approve your account
      </p>
      <div className="mt-8">
        <SignupForm />
      </div>
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
          Sign in
        </Link>
      </div>
    </div>
  );
}
