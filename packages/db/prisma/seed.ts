/**
 * Prisma seed script.
 * Idempotent: safe to run multiple times.
 * Seeds: currencies, countries, payment methods, root causes, roles, permissions,
 *        email templates, store message templates, default admin user.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  currencies,
  countries as countryRegistryData,
  paymentMethods,
  rootCauses,
  roles as roleSeeds,
  permissions as permissionSeeds,
  emailTemplates,
  storeMessageTemplates,
} from '../src/seed-data';

const prisma = new PrismaClient();

async function seedCurrencies() {
  console.log(`→ Seeding ${currencies.length} currencies...`);
  for (const c of currencies) {
    await prisma.currencyRegistry.upsert({
      where: { code: c.code },
      create: c,
      update: c,
    });
  }
}

async function seedCountryRegistry() {
  console.log(`→ Seeding ${countryRegistryData.length} countries (registry)...`);
  for (const c of countryRegistryData) {
    await prisma.countryRegistry.upsert({
      where: { code: c.code },
      create: c,
      update: c,
    });
  }
}

async function seedPaymentMethods() {
  console.log(`→ Seeding ${paymentMethods.length} payment methods...`);
  for (const pm of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { key: pm.key },
      create: pm,
      update: pm,
    });
  }
}

async function seedRootCauses() {
  console.log(`→ Seeding ${rootCauses.length} root causes...`);
  for (const rc of rootCauses) {
    await prisma.rootCause.upsert({
      where: { key: rc.key },
      create: rc,
      update: rc,
    });
  }
}

async function seedPermissionsAndRoles() {
  console.log(`→ Seeding ${permissionSeeds.length} permissions...`);
  for (const p of permissionSeeds) {
    await prisma.permission.upsert({
      where: { key: p.key },
      create: p,
      update: { category: p.category, description: p.description },
    });
  }

  console.log(`→ Seeding ${roleSeeds.length} roles...`);
  for (const r of roleSeeds) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      create: {
        key: r.key,
        name: r.name,
        nameAr: r.nameAr,
        description: r.description,
        isSystem: r.isSystem,
      },
      update: {
        name: r.name,
        nameAr: r.nameAr,
        description: r.description,
        isSystem: r.isSystem,
      },
    });

    // Wipe and set permissions for the role (idempotent)
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const perms = await prisma.permission.findMany({
      where: { key: { in: r.permissions } },
    });
    for (const p of perms) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: p.id },
      });
    }
  }
}

async function seedEmailTemplates() {
  console.log(`→ Seeding ${emailTemplates.length} email templates...`);
  for (const t of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: {
        key_locale: { key: t.key, locale: t.locale },
      },
      create: {
        key: t.key,
        category: t.category,
        locale: t.locale,
        subject: t.subject,
        body: t.body,
        placeholders: JSON.stringify(t.placeholders),
        description: t.description,
      },
      update: {
        category: t.category,
        subject: t.subject,
        body: t.body,
        placeholders: JSON.stringify(t.placeholders),
        description: t.description,
      },
    });
  }
}

async function seedStoreMessageTemplates() {
  console.log(`→ Seeding ${storeMessageTemplates.length} store message templates...`);
  for (const t of storeMessageTemplates) {
    await prisma.storeMessageTemplate.upsert({
      where: { key: t.key },
      create: t,
      update: t,
    });
  }
}

async function seedActiveCountries() {
  // Activate GCC countries by default (admin can activate more from UI).
  const GCC_ACTIVE = ['KW', 'SA', 'AE', 'BH', 'OM', 'QA'];
  console.log(`→ Activating ${GCC_ACTIVE.length} GCC countries by default...`);
  for (let i = 0; i < GCC_ACTIVE.length; i++) {
    const code = GCC_ACTIVE[i]!;
    const reg = await prisma.countryRegistry.findUnique({ where: { code } });
    if (!reg) continue;
    await prisma.country.upsert({
      where: { registryCode: code },
      create: {
        registryCode: code,
        isActive: true,
        cutoffTime: '17:00',
        sortOrder: i * 10,
      },
      update: {},
    });
  }
}

async function seedDefaultBrands() {
  console.log('→ Seeding default brands...');
  const brands = [
    { name: 'Chipotle', nameAr: 'تشيبوتلي', slug: 'chipotle', sortOrder: 10 },
    { name: 'Starbucks', nameAr: 'ستاربكس', slug: 'starbucks', sortOrder: 20 },
    { name: 'Victoria\'s Secret', nameAr: 'فيكتوريا سيكريت', slug: 'victorias-secret', sortOrder: 30 },
    { name: 'Bath & Body Works', nameAr: 'باث أند بودي ووركس', slug: 'bath-body-works', sortOrder: 40 },
  ];
  for (const b of brands) {
    await prisma.brand.upsert({
      where: { slug: b.slug },
      create: b,
      update: b,
    });
  }
}

async function seedBrandCountries() {
  console.log('→ Linking brands to active countries...');
  const [brands, countries] = await Promise.all([
    prisma.brand.findMany({ where: { isActive: true } }),
    prisma.country.findMany({ where: { isActive: true } }),
  ]);
  for (const b of brands) {
    for (const c of countries) {
      await prisma.brandCountry.upsert({
        where: { brandId_countryId: { brandId: b.id, countryId: c.id } },
        create: { brandId: b.id, countryId: c.id, isActive: true },
        update: { isActive: true },
      });
    }
  }
}

/**
 * Seed PromoConfig pools (3 customer-compensation tiers + 1 service-recovery)
 * per brand × active country, plus a batch of AVAILABLE codes in each pool.
 */
async function seedPromos() {
  console.log('→ Seeding promo pools and codes...');
  const [brands, countries] = await Promise.all([
    prisma.brand.findMany({ where: { isActive: true } }),
    prisma.country.findMany({ where: { isActive: true }, include: { registry: true } }),
  ]);

  for (const brand of brands) {
    for (const country of countries) {
      const currency = country.registry?.currencyCode ?? 'USD';
      const compensationTiers: Array<{ value: number; label: string }> = [
        { value: 10, label: 'Small compensation' },
        { value: 25, label: 'Standard compensation' },
        { value: 50, label: 'Large compensation' },
      ];

      for (const tier of compensationTiers) {
        const pool = await prisma.promoConfig.upsert({
          where: {
            brandId_countryId_type_value: {
              brandId: brand.id,
              countryId: country.id,
              type: 'CUSTOMER_COMPENSATION',
              value: tier.value,
            },
          },
          create: {
            brandId: brand.id,
            countryId: country.id,
            type: 'CUSTOMER_COMPENSATION',
            value: tier.value,
            currency,
            label: `${brand.name} · ${country.registryCode} · ${tier.label}`,
            isActive: true,
          },
          update: { isActive: true },
        });
        await ensurePoolStock(pool.id, brand.slug, country.registryCode, tier.value, 'C');
      }

      const recoveryPool = await prisma.promoConfig.upsert({
        where: {
          brandId_countryId_type_value: {
            brandId: brand.id,
            countryId: country.id,
            type: 'SERVICE_RECOVERY',
            value: 100,
          },
        },
        create: {
          brandId: brand.id,
          countryId: country.id,
          type: 'SERVICE_RECOVERY',
          value: 100,
          currency,
          label: `${brand.name} · ${country.registryCode} · Service recovery (100%)`,
          isActive: true,
        },
        update: { isActive: true },
      });
      await ensurePoolStock(recoveryPool.id, brand.slug, country.registryCode, 100, 'S');
    }
  }
}

async function ensurePoolStock(
  poolId: string,
  brandSlug: string,
  countryCode: string,
  value: number,
  kind: 'C' | 'S',
) {
  const existing = await prisma.promoCode.count({ where: { configId: poolId } });
  const target = 20;
  if (existing >= target) return;
  const needed = target - existing;
  const codes = Array.from({ length: needed }, (_, i) => ({
    configId: poolId,
    code: `${kind}-${brandSlug.substring(0, 3).toUpperCase()}-${countryCode}-${value}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`,
    status: 'AVAILABLE' as const,
    uploadedAt: new Date(),
  }));
  await prisma.promoCode.createMany({ data: codes });
}

async function seedDefaultAdmin() {
  const email = 'admin@wow.local';
  const password = 'admin123';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`→ Default admin already exists (${email})`);
    return;
  }

  const role = await prisma.role.findUnique({ where: { key: 'ADMIN' } });
  if (!role) throw new Error('ADMIN role not seeded');

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      name: 'Default Admin',
      nameAr: 'مدير افتراضي',
      status: 'ACTIVE',
      passwordHash,
      mustChangePassword: false,
      roleId: role.id,
      approvedAt: new Date(),
      preferredLocale: 'en',
    },
  });
  console.log(`→ Created default admin: ${email} / ${password}`);
}

async function seedMaintenanceCountrySupervisors() {
  const seeds = [
    { countryName: 'Kuwait',       name: 'KW Maintenance Lead', email: 'maintenance.kw@wow.local' },
    { countryName: 'Saudi Arabia', name: 'SA Maintenance Lead', email: 'maintenance.sa@wow.local' },
    { countryName: 'KSA',          name: 'SA Maintenance Lead', email: 'maintenance.sa@wow.local' },
    { countryName: 'UAE',          name: 'UAE Maintenance Lead', email: 'maintenance.uae@wow.local' },
    { countryName: 'Egypt',        name: 'EG Maintenance Lead', email: 'maintenance.eg@wow.local' },
  ];
  for (const s of seeds) {
    await prisma.maintenanceCountrySupervisor.upsert({
      where: { countryName_email: { countryName: s.countryName, email: s.email } },
      create: { ...s, isActive: true },
      update: { name: s.name, isActive: true },
    });
  }
  console.log(`→ Seeded ${seeds.length} maintenance country supervisors.`);
}

async function seedDemoMaintenanceRequests() {
  if (process.env['SEED_DEMO_CASES'] !== '1') return;
  const existing = await prisma.maintenanceRequest.count();
  if (existing > 0) {
    console.log(`→ Demo maintenance requests skipped (${existing} already exist)`);
    return;
  }
  const samples = [
    {
      ticketRef: 'MR-2026-000001',
      countryName: 'KSA', cityName: 'Riyadh',
      customerName: 'Nestlé Saudi',
      storeName: 'ninja shbra', location: 'https://maps.app.goo.gl/9zQBftYGnhmk5Dce6',
      submitterName: 'hassan', contactNumber: '0562606750', email: 'hassan@nestle.com',
      machineModel: 'thermoplan', issueType: 'coffee machine not working after clean',
      status: 'PENDING' as const,
    },
    {
      ticketRef: 'MR-2026-000002',
      countryName: 'Egypt', cityName: 'Cairo',
      customerName: 'Nestle',
      storeName: 'Hilton Heliopolis hotel', location: 'Hilton Heliopolis',
      submitterName: 'Mohamed Debeikyy', contactNumber: '01127409870', email: 'mohamed.debeiky@eg.nestle.com',
      machineModel: 'FrankeFM850', issueType: 'Machine not working',
      status: 'IN_PROGRESS' as const,
    },
  ];
  for (const s of samples) {
    await prisma.maintenanceRequest.create({
      data: { ...s, source: 'MS_FORM' },
    });
  }
  console.log(`→ Seeded ${samples.length} demo maintenance requests.`);
}

async function seedDemoCases() {
  // Only seed demo cases when explicitly requested.
  if (process.env['SEED_DEMO_CASES'] !== '1') {
    console.log('→ Skipping demo cases (set SEED_DEMO_CASES=1 to seed)');
    return;
  }

  // Skip if any cases already exist
  const existing = await prisma.refundCase.count();
  if (existing > 0) {
    console.log(`→ Demo cases skipped (${existing} cases already exist)`);
    return;
  }

  console.log('→ Seeding demo refund cases...');

  const admin = await prisma.user.findUnique({ where: { email: 'admin@wow.local' } });
  const kuwait = await prisma.country.findUnique({ where: { registryCode: 'KW' } });
  const saudi = await prisma.country.findUnique({ where: { registryCode: 'SA' } });
  const chipotle = await prisma.brand.findUnique({ where: { slug: 'chipotle' } });
  const starbucks = await prisma.brand.findUnique({ where: { slug: 'starbucks' } });
  const applePay = await prisma.paymentMethod.findUnique({ where: { key: 'APPLE_PAY' } });
  const knet = await prisma.paymentMethod.findUnique({ where: { key: 'KNET' } });
  const mastercard = await prisma.paymentMethod.findUnique({ where: { key: 'MASTERCARD' } });
  const rootCause = await prisma.rootCause.findFirst();

  if (
    !admin ||
    !kuwait ||
    !saudi ||
    !chipotle ||
    !starbucks ||
    !applePay ||
    !knet ||
    !mastercard
  ) {
    console.log('  ! Missing prerequisites, skipping demo cases');
    return;
  }

  // Seed a handful of branches so case rows/details can show a real
  // physical location. Branches are per-country, so we tag each by the
  // country id they belong to.
  const branchSpecs = [
    { country: kuwait, name: 'The Avenues Mall', code: 'KW-AVN' },
    { country: kuwait, name: 'Al-Kout Mall', code: 'KW-KOT' },
    { country: saudi, name: 'Kingdom Centre Riyadh', code: 'SA-KCR' },
    { country: saudi, name: 'Red Sea Mall Jeddah', code: 'SA-RSM' },
  ];
  const branchByCode = new Map<string, { id: string; countryId: string }>();
  for (const spec of branchSpecs) {
    const b = await prisma.branch.upsert({
      where: {
        countryId_name: { countryId: spec.country.id, name: spec.name },
      },
      create: {
        countryId: spec.country.id,
        name: spec.name,
        code: spec.code,
      },
      update: {},
    });
    branchByCode.set(spec.code, { id: b.id, countryId: b.countryId });
  }

  type Demo = {
    countryId: string;
    brandId: string;
    branchCode?: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    orderNumber: string;
    orderAmount: number;
    orderCurrency: string;
    status: string;
    // Single payment method per case — an agent only records the network
    // the customer paid with, not a split across multiple rails. Aura
    // points are tracked separately on the case (sidecar).
    component: { paymentMethodId: string; authCode?: string };
    /** Falls back to orderAmount when omitted (full refund). */
    refundAmount?: number;
    auraPoints?: number;
    notes?: string[];
  };

  const demos: Demo[] = [
    {
      countryId: kuwait.id,
      brandId: chipotle.id,
      branchCode: 'KW-AVN',
      customerName: 'Sara Al-Fahad',
      customerEmail: 'sara.fahad@example.com',
      customerPhone: '+96599887766',
      orderNumber: 'CHP-KW-89231',
      orderAmount: 12.5,
      orderCurrency: 'KWD',
      status: 'DRAFT',
      component: { paymentMethodId: applePay.id },
      notes: ['Customer reported missing items in delivery.'],
    },
    {
      countryId: kuwait.id,
      brandId: starbucks.id,
      branchCode: 'KW-KOT',
      customerName: 'Omar Khan',
      customerEmail: 'omar.k@example.com',
      customerPhone: '+96566554433',
      orderNumber: 'SBX-KW-44102',
      orderAmount: 8.75,
      orderCurrency: 'KWD',
      status: 'PENDING_APPROVAL',
      component: { paymentMethodId: knet.id, authCode: 'A12B34' },
      notes: ['Drink prepared incorrectly twice.', 'Manager confirmed full refund.'],
    },
    {
      countryId: saudi.id,
      brandId: chipotle.id,
      branchCode: 'SA-KCR',
      customerName: 'Layla Hussain',
      customerEmail: 'layla.h@example.com',
      customerPhone: '+966500112233',
      orderNumber: 'CHP-SA-77345',
      orderAmount: 95.0,
      orderCurrency: 'SAR',
      status: 'APPROVED',
      component: { paymentMethodId: mastercard.id },
      auraPoints: 500,
    },
    {
      countryId: kuwait.id,
      brandId: chipotle.id,
      branchCode: 'KW-AVN',
      customerName: 'Yousef Al-Mutairi',
      customerEmail: 'yousef.m@example.com',
      customerPhone: '+96598765432',
      orderNumber: 'CHP-KW-92044',
      orderAmount: 22.0,
      orderCurrency: 'KWD',
      status: 'PARTIALLY_REFUNDED',
      component: { paymentMethodId: mastercard.id },
      refundAmount: 14.0,
    },
    {
      countryId: saudi.id,
      brandId: starbucks.id,
      branchCode: 'SA-RSM',
      customerName: 'Reem Al-Saud',
      customerEmail: 'reem.s@example.com',
      customerPhone: '+966512345678',
      orderNumber: 'SBX-SA-22198',
      orderAmount: 60.0,
      orderCurrency: 'SAR',
      status: 'REFUNDED',
      component: { paymentMethodId: mastercard.id },
      auraPoints: 200,
      notes: ['Refund completed in batch.'],
    },
  ];

  for (let i = 0; i < demos.length; i++) {
    const d = demos[i]!;
    const country = await prisma.country.findUnique({
      where: { id: d.countryId },
      include: { registry: true },
    });
    if (!country) continue;

    const year = new Date().getFullYear();
    const caseNumber = `REF-${country.registry.code}-${year}-${(i + 1).toString().padStart(6, '0')}`;
    const totalRefund = d.refundAmount ?? d.orderAmount;
    const isPartial = Math.abs(totalRefund - d.orderAmount) > 0.001;

    const created = await prisma.refundCase.create({
      data: {
        caseNumber,
        // Fabricated CRM reference so seeded cases surface in external-ticket searches.
        externalCaseNumber: `CRM-${(100000 + i + 1).toString()}`,
        countryId: d.countryId,
        branchId: d.branchCode ? branchByCode.get(d.branchCode)?.id ?? null : null,
        brandId: d.brandId,
        customerName: d.customerName,
        customerEmail: d.customerEmail,
        customerPhone: d.customerPhone,
        orderNumber: d.orderNumber,
        orderDate: new Date(Date.now() - (i + 1) * 86_400_000),
        orderAmount: d.orderAmount,
        orderCurrency: d.orderCurrency,
        totalRefundAmount: totalRefund,
        isPartial,
        status: d.status as never,
        auraPoints: d.auraPoints ?? null,
        auraStatus: d.auraPoints
          ? d.status === 'REFUNDED'
            ? 'COMPLETED'
            : 'PENDING'
          : 'NONE',
        rootCauseId: rootCause?.id ?? null,
        createdById: admin.id,
        approvedById: ['APPROVED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(d.status) ? admin.id : null,
        approvedAt: ['APPROVED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(d.status) ? new Date() : null,
        components: {
          create: {
            paymentMethodId: d.component.paymentMethodId,
            amount: totalRefund,
            currency: d.orderCurrency,
            authCode: d.component.authCode ?? null,
            status:
              d.status === 'REFUNDED'
                ? 'REFUNDED'
                : d.status === 'PARTIALLY_REFUNDED'
                  ? 'AWAITING_BATCH'
                  : 'PENDING',
          },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        caseId: created.id,
        actorId: admin.id,
        actorLabel: admin.name,
        kind: 'case.created',
        message: `Case ${caseNumber} created`,
      },
    });

    if (d.notes) {
      for (const body of d.notes) {
        await prisma.caseNote.create({
          data: { caseId: created.id, authorId: admin.id, body },
        });
      }
    }
  }

  console.log(`→ Seeded ${demos.length} demo cases.`);

  // Add a couple of unread notifications for the admin
  await prisma.notification.create({
    data: {
      userId: admin.id,
      type: 'CASE_ASSIGNED',
      title: 'Welcome — review your refund cases',
      body: 'Demo data has been seeded. Open the Cases page to explore.',
      href: '/cases',
    },
  });
}

/**
 * Realistic Refund Pool scenario:
 * 5 APPROVED cases (KW, SA, AE, BH, OM) with manager-approved batches,
 * full customer contact log, and components ready for KNET/Aura execution.
 *
 * Idempotent — keyed off case numbers REF-XX-YYYY-9000XX. Skipped unless
 * SEED_REFUND_POOL=1 is set so prod / CI never picks it up by accident.
 */
async function seedRefundPoolScenario() {
  if (process.env['SEED_REFUND_POOL'] !== '1') {
    console.log('→ Skipping refund pool scenario (set SEED_REFUND_POOL=1 to seed)');
    return;
  }
  console.log('→ Seeding Refund Pool demo scenario (5 approved cases)...');

  const admin = await prisma.user.findUnique({ where: { email: 'admin@wow.local' } });
  if (!admin) {
    console.log('  ! admin missing, skipping');
    return;
  }
  const knet = await prisma.paymentMethod.findUnique({ where: { key: 'KNET' } });
  const apple = await prisma.paymentMethod.findUnique({ where: { key: 'APPLE_PAY' } });
  const visa = await prisma.paymentMethod.findUnique({ where: { key: 'VISA' } });
  const mastercard = await prisma.paymentMethod.findUnique({ where: { key: 'MASTERCARD' } });
  if (!knet || !apple || (!visa && !mastercard)) {
    console.log('  ! payment methods missing, skipping');
    return;
  }
  const card = visa ?? mastercard!;

  type Scenario = {
    countryCode: string;
    brandSlug: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    orderNumber: string;
    orderAmount: number;
    refundAmount: number;
    currency: string;
    paymentMethodId: string;
    paymentLabel: string;
    authCode?: string;
    last4?: string;
    auraPoints?: number;
    contactAttempts: { atHoursAgo: number; channel: string; outcome: string; agent: string }[];
    managerEmail: string;
    managerReply: string;
    rootCauseSummary: string;
  };

  const scenarios: Scenario[] = [
    {
      countryCode: 'KW',
      brandSlug: 'starbucks',
      customerName: 'Noor Al-Sabah',
      customerEmail: 'noor.sabah@example.com',
      customerPhone: '+96599112233',
      orderNumber: 'SBX-KW-90015',
      orderAmount: 8.75,
      refundAmount: 8.75,
      currency: 'KWD',
      paymentMethodId: knet.id,
      paymentLabel: 'KNET',
      authCode: 'A77231',
      contactAttempts: [
        { atHoursAgo: 30, channel: 'Phone', outcome: 'No answer', agent: 'Default Admin' },
        { atHoursAgo: 26, channel: 'WhatsApp', outcome: 'Customer confirmed refund preference: KNET', agent: 'Default Admin' },
      ],
      managerEmail: 'kw-manager@wow.local',
      managerReply: 'Approved — please process the refund. — KW Manager',
      rootCauseSummary: 'Wrong drink delivered twice; customer asked for full refund.',
    },
    {
      countryCode: 'SA',
      brandSlug: 'chipotle',
      customerName: 'Faisal Al-Otaibi',
      customerEmail: 'faisal.otaibi@example.com',
      customerPhone: '+966500445566',
      orderNumber: 'CHP-SA-90217',
      orderAmount: 95.0,
      refundAmount: 95.0,
      currency: 'SAR',
      paymentMethodId: card.id,
      paymentLabel: card.key === 'VISA' ? 'Visa' : 'Mastercard',
      last4: '4421',
      contactAttempts: [
        { atHoursAgo: 22, channel: 'Phone', outcome: 'Customer reached, refund acknowledged', agent: 'Default Admin' },
      ],
      managerEmail: 'sa-manager@wow.local',
      managerReply: 'Approved. SA Country Manager.',
      rootCauseSummary: 'Order missing two main bowls; partial fulfilment refused.',
    },
    {
      countryCode: 'AE',
      brandSlug: 'starbucks',
      customerName: 'Maryam Al-Marzooqi',
      customerEmail: 'maryam.m@example.com',
      customerPhone: '+971501234567',
      orderNumber: 'SBX-AE-90118',
      orderAmount: 35.0,
      refundAmount: 35.0,
      currency: 'AED',
      paymentMethodId: apple.id,
      paymentLabel: 'Apple Pay',
      contactAttempts: [
        { atHoursAgo: 18, channel: 'Phone', outcome: 'Voicemail left', agent: 'Default Admin' },
        { atHoursAgo: 14, channel: 'Email', outcome: 'Customer replied, refund approved on original card', agent: 'Default Admin' },
      ],
      managerEmail: 'ae-manager@wow.local',
      managerReply: 'Approved — proceed with Apple Pay reversal. UAE Manager',
      rootCauseSummary: 'Late delivery (>60 minutes); compensation refund requested.',
    },
    {
      countryCode: 'BH',
      brandSlug: 'chipotle',
      customerName: 'Khalid Al-Khalifa',
      customerEmail: 'khalid.k@example.com',
      customerPhone: '+97333445566',
      orderNumber: 'CHP-BH-90042',
      orderAmount: 12.0,
      refundAmount: 12.0,
      currency: 'BHD',
      paymentMethodId: card.id,
      paymentLabel: card.key === 'VISA' ? 'Visa' : 'Mastercard',
      last4: '8881',
      auraPoints: 200,
      contactAttempts: [
        { atHoursAgo: 12, channel: 'Phone', outcome: 'Customer agreed refund + 200 Aura goodwill', agent: 'Default Admin' },
      ],
      managerEmail: 'bh-manager@wow.local',
      managerReply: 'Approved with 200 Aura goodwill. BH Manager.',
      rootCauseSummary: 'Cold food on delivery; offered card refund + Aura points.',
    },
    {
      countryCode: 'OM',
      brandSlug: 'starbucks',
      customerName: 'Sultan Al-Busaidi',
      customerEmail: 'sultan.b@example.com',
      customerPhone: '+96891234567',
      orderNumber: 'SBX-OM-90067',
      orderAmount: 6.0,
      refundAmount: 6.0,
      currency: 'OMR',
      paymentMethodId: knet.id,
      paymentLabel: 'KNET',
      authCode: 'A91204',
      contactAttempts: [
        { atHoursAgo: 9, channel: 'Phone', outcome: 'Customer confirmed KNET refund preference', agent: 'Default Admin' },
        { atHoursAgo: 5, channel: 'SMS', outcome: 'Refund tracking link sent', agent: 'Default Admin' },
      ],
      managerEmail: 'om-manager@wow.local',
      managerReply: 'Approved. OM Country Manager.',
      rootCauseSummary: 'Stale pastry; customer requested refund of single line item.',
    },
  ];

  const rootCause = await prisma.rootCause.findFirst();

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i]!;
    const country = await prisma.country.findUnique({
      where: { registryCode: s.countryCode },
      include: { registry: true },
    });
    const brand = await prisma.brand.findUnique({ where: { slug: s.brandSlug } });
    if (!country || !brand) {
      console.log(`  ! ${s.countryCode}/${s.brandSlug} not active, skipping ${s.customerName}`);
      continue;
    }

    const caseNumber = `REF-${country.registry.code}-${new Date().getFullYear()}-9${(i + 1).toString().padStart(5, '0')}`;
    const existing = await prisma.refundCase.findUnique({ where: { caseNumber } });
    if (existing) {
      console.log(`  · ${caseNumber} already exists, skipping`);
      continue;
    }

    // Approval batch — one per country, status DECIDED, manager replied positively.
    const batchNumber = `APB-${country.registry.code}-${new Date().getFullYear()}-9${(i + 1).toString().padStart(4, '0')}`;
    const approvalBatch = await prisma.approvalBatch.create({
      data: {
        batchNumber,
        countryId: country.id,
        status: 'COMPLETED',
        createdById: admin.id,
        scheduledFor: new Date(Date.now() - 2 * 86_400_000),
        sentAt: new Date(Date.now() - 2 * 86_400_000),
        recipientEmails: s.managerEmail,
        responseReceivedAt: new Date(Date.now() - 1 * 86_400_000),
        responseRawBody: s.managerReply,
        responseParsed: JSON.stringify({ decisions: [{ caseNumber, decision: 'APPROVED' }] }),
        totalCases: 1,
        approvedCases: 1,
        rejectedCases: 0,
        completedAt: new Date(Date.now() - 1 * 86_400_000),
      },
    });

    // Update country managerEmail if it was empty so the UI shows it set.
    if (!country.managerEmail) {
      await prisma.country.update({ where: { id: country.id }, data: { managerEmail: s.managerEmail } });
    }

    const created = await prisma.refundCase.create({
      data: {
        caseNumber,
        externalCaseNumber: `CRM-9${(100000 + i).toString()}`,
        countryId: country.id,
        brandId: brand.id,
        customerName: s.customerName,
        customerEmail: s.customerEmail,
        customerPhone: s.customerPhone,
        customerNotes: s.rootCauseSummary,
        orderNumber: s.orderNumber,
        orderDate: new Date(Date.now() - 3 * 86_400_000),
        orderAmount: s.orderAmount,
        orderCurrency: s.currency,
        totalRefundAmount: s.refundAmount,
        isPartial: Math.abs(s.refundAmount - s.orderAmount) > 0.001,
        status: 'APPROVED',
        rootCauseId: rootCause?.id ?? null,
        rootCauseNotes: s.rootCauseSummary,
        createdById: admin.id,
        approvedById: admin.id,
        approvedAt: new Date(Date.now() - 1 * 86_400_000),
        approvalBatchId: approvalBatch.id,
        auraPoints: s.auraPoints ?? null,
        auraStatus: s.auraPoints ? 'PENDING' : 'NONE',
        components: {
          create: {
            paymentMethodId: s.paymentMethodId,
            amount: s.refundAmount,
            currency: s.currency,
            authCode: s.authCode ?? null,
            last4: s.last4 ?? null,
            // Approved & ready to be added to the next KNET / card refund batch.
            status: 'AWAITING_BATCH',
          },
        },
      },
    });

    // Activity log: created → manager email sent → manager replied → contact attempts → approved
    const baseTime = Date.now() - 3 * 86_400_000;
    await prisma.activityLog.createMany({
      data: [
        {
          caseId: created.id,
          actorId: admin.id,
          actorLabel: admin.name,
          kind: 'case.created',
          message: `Case ${caseNumber} created`,
          createdAt: new Date(baseTime),
        },
        {
          caseId: created.id,
          actorId: admin.id,
          actorLabel: admin.name,
          kind: 'batch.sent',
          message: `Approval batch ${batchNumber} sent to ${s.managerEmail}`,
          createdAt: new Date(baseTime + 4 * 3600_000),
        },
        {
          caseId: created.id,
          actorLabel: 'Power Automate',
          kind: 'batch.replied',
          message: `Manager approval received for ${caseNumber}`,
          createdAt: new Date(Date.now() - 1 * 86_400_000),
        },
        ...s.contactAttempts.map((c) => ({
          caseId: created.id,
          actorId: admin.id,
          actorLabel: c.agent,
          kind: 'case.contact_attempt',
          message: `${c.channel}: ${c.outcome}`,
          metadata: JSON.stringify({ channel: c.channel, outcome: c.outcome }),
          createdAt: new Date(Date.now() - c.atHoursAgo * 3600_000),
        })),
      ],
    });

    // Notes mirror the contact log so they also surface on /cases/:id.
    for (const c of s.contactAttempts) {
      await prisma.caseNote.create({
        data: {
          caseId: created.id,
          authorId: admin.id,
          body: `[CONTACT · ${c.channel}] ${c.outcome}`,
          createdAt: new Date(Date.now() - c.atHoursAgo * 3600_000),
        },
      });
    }

    console.log(`  ✓ ${caseNumber} (${s.customerName}, ${s.paymentLabel}, ${s.refundAmount} ${s.currency})`);
  }

  console.log('→ Refund Pool scenario seeded.');
}

async function seedFeatureFlags() {
  const flags = [
    { key: 'feature.promo.compensation', enabled: true, description: 'Enable customer compensation promos' },
    { key: 'feature.promo.service_recovery', enabled: true, description: 'Enable service recovery promos' },
    { key: 'feature.fraud_signals', enabled: true, description: 'Enable fraud detection signals' },
    { key: 'feature.scheduled_reports', enabled: true, description: 'Enable scheduled email reports' },
    { key: 'feature.dark_mode', enabled: true, description: 'Allow users to switch to dark mode' },
    { key: 'feature.help_desk.stores_communication', enabled: true, description: 'Stores Communication module' },
  ];
  console.log(`→ Seeding ${flags.length} feature flags...`);
  for (const f of flags) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      create: f,
      update: { description: f.description },
    });
  }
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  WOW Refund v2 — Seeding database');
  console.log('═══════════════════════════════════════════\n');

  await seedCurrencies();
  await seedCountryRegistry();
  await seedPaymentMethods();
  await seedRootCauses();
  await seedPermissionsAndRoles();
  await seedEmailTemplates();
  await seedStoreMessageTemplates();
  await seedActiveCountries();
  await seedDefaultBrands();
  await seedBrandCountries();
  await seedPromos();
  await seedDefaultAdmin();
  await seedFeatureFlags();
  await seedMaintenanceCountrySupervisors();
  await seedDemoMaintenanceRequests();
  await seedDemoCases();
  await seedRefundPoolScenario();

  console.log('\n✓ Seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
