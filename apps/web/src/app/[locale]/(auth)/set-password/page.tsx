import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SetPasswordForm } from './set-password-form';

export default async function SetPasswordPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        Set your password
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Choose a secure password for your account
      </p>
      <div className="mt-8">
        <SetPasswordForm />
      </div>
    </div>
  );
}
