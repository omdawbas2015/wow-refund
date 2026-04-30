import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const t = await getTranslations('auth.login');
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? '/';

  return (
    <Card className="shadow-lg border-border/50">
      <CardHeader className="space-y-2 pb-6">
        <CardTitle className="text-2xl font-semibold tracking-tight">{t('title')}</CardTitle>
        <CardDescription className="text-[13px]">{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm callbackUrl={callbackUrl} error={params.error} />
        <div className="mt-6 text-center text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            {t('signupLink')}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
