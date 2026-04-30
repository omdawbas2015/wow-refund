import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CountriesEditor, type CountryRow, type BrandOption } from './editor';

export const dynamic = 'force-dynamic';

export default async function CountriesAdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const [registry, brands] = await Promise.all([
    prisma.countryRegistry.findMany({
      orderBy: { code: 'asc' },
      include: {
        currency: { select: { symbol: true } },
        countries: {
          include: {
            _count: { select: { cases: true } },
            brandCountries: {
              where: { isActive: true },
              select: { brandId: true },
            },
          },
        },
      },
    }),
    prisma.brand.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, nameAr: true, slug: true, isActive: true },
    }),
  ]);

  const rows: CountryRow[] = registry.map((r) => {
    const active = r.countries[0];
    return {
      registryCode: r.code,
      name: r.nameEn,
      nameAr: r.nameAr,
      flag: r.flag,
      currencyCode: r.currencyCode,
      currencySymbol: r.currency?.symbol ?? '',
      isActive: active?.isActive ?? false,
      managerEmail: active?.managerEmail ?? null,
      cutoffTime: active?.cutoffTime ?? '17:00',
      sortOrder: active?.sortOrder ?? 0,
      caseCount: active?._count.cases ?? 0,
      activeBrandIds: (active?.brandCountries ?? []).map((bc) => bc.brandId),
    };
  });

  const brandOptions: BrandOption[] = brands.map((b) => ({
    id: b.id,
    name: b.name,
    nameAr: b.nameAr ?? null,
    slug: b.slug,
    isActive: b.isActive,
  }));

  const activeCount = rows.filter((r) => r.isActive).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-8 py-10">
      <div>
        <h1 className="text-display-md font-semibold tracking-tight text-heading">Countries</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Activate the countries your business operates in. Each active country plugs into case
          creation, promo configs, reports, and SLA rules — its currency lights up automatically and
          you choose which brands operate there.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>
            {activeCount} active · {rows.length} total
          </CardTitle>
          <CardDescription>
            Click <span className="font-medium text-foreground">Activate</span> on a new country to
            set its manager email, daily cutoff, and brand availability in a single dialog.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <CountriesEditor rows={rows} brands={brandOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
