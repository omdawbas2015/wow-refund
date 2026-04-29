'use server';

import { prisma } from '@wow/db';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import {
  upsertCountrySettingsSchema,
  type UpsertCountrySettingsInput,
} from '@wow/validators';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  if (session.user.role !== 'ADMIN') throw new Error('FORBIDDEN');
  return session.user;
}

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

export async function toggleCountryActiveAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const registryCode = String(formData.get('registryCode') ?? '');
  const activate = String(formData.get('activate') ?? 'true') === 'true';

  if (!registryCode) return;

  const existing = await prisma.country.findUnique({ where: { registryCode } });

  if (existing) {
    await prisma.country.update({ where: { id: existing.id }, data: { isActive: activate } });
  } else if (activate) {
    await prisma.country.create({ data: { registryCode, isActive: true } });
  }

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      actorEmail: admin.email,
      action: activate ? 'country.activated' : 'country.deactivated',
      entityType: 'COUNTRY',
      entityId: registryCode,
    },
  });

  revalidatePath('/admin/countries');
}

/**
 * Activate or update a country in one shot, including which brands operate
 * there. Idempotent: creates the Country row on first activation, updates it
 * thereafter, and reconciles BrandCountry m2m links to exactly match
 * `brandIds` (deactivates links that fall out, upserts links that stay).
 *
 * Audit log captures the before/after Country snapshot plus the brand-id
 * delta so reviewers can see what changed.
 */
export async function upsertCountrySettingsAction(
  input: UpsertCountrySettingsInput,
): Promise<ActionResult<{ countryId: string }>> {
  try {
    const admin = await requireAdmin();
    const parsed = upsertCountrySettingsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }
    const { registryCode, isActive, managerEmail, cutoffTime, sortOrder, brandIds } = parsed.data;

    const registry = await prisma.countryRegistry.findUnique({ where: { code: registryCode } });
    if (!registry) return { ok: false, error: 'Unknown country code' };

    if (brandIds.length > 0) {
      const found = await prisma.brand.findMany({
        where: { id: { in: brandIds } },
        select: { id: true },
      });
      if (found.length !== brandIds.length) {
        return { ok: false, error: 'One or more brands no longer exist' };
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.country.findUnique({
        where: { registryCode },
        include: { brandCountries: { select: { brandId: true, isActive: true } } },
      });

      const country = before
        ? await tx.country.update({
            where: { id: before.id },
            data: {
              isActive,
              managerEmail: managerEmail || null,
              cutoffTime,
              sortOrder,
            },
          })
        : await tx.country.create({
            data: {
              registryCode,
              isActive,
              managerEmail: managerEmail || null,
              cutoffTime,
              sortOrder,
            },
          });

      // Reconcile BrandCountry: deactivate brand links that aren't in the new
      // selection, upsert links that are.
      const desired = new Set(brandIds);
      const existingActive = new Set(
        (before?.brandCountries ?? []).filter((bc) => bc.isActive).map((bc) => bc.brandId),
      );

      const toDeactivate = [...existingActive].filter((id) => !desired.has(id));
      if (toDeactivate.length > 0) {
        await tx.brandCountry.updateMany({
          where: { countryId: country.id, brandId: { in: toDeactivate } },
          data: { isActive: false },
        });
      }

      for (const brandId of brandIds) {
        await tx.brandCountry.upsert({
          where: { brandId_countryId: { brandId, countryId: country.id } },
          create: { brandId, countryId: country.id, isActive: true },
          update: { isActive: true },
        });
      }

      return { country, beforeBrands: [...existingActive], afterBrands: brandIds };
    });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        actorEmail: admin.email,
        action: isActive ? 'country.upserted' : 'country.deactivated',
        entityType: 'COUNTRY',
        entityId: result.country.id,
        beforeData: JSON.stringify({ brandIds: result.beforeBrands }),
        afterData: JSON.stringify({
          isActive,
          managerEmail: managerEmail || null,
          cutoffTime,
          sortOrder,
          brandIds: result.afterBrands,
        }),
      },
    });

    revalidatePath('/admin/countries');
    revalidatePath('/admin/brands');
    return { ok: true, data: { countryId: result.country.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toggleBrandActiveAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const brandId = String(formData.get('brandId') ?? '');
  const activate = String(formData.get('activate') ?? 'true') === 'true';

  if (!brandId) return;

  await prisma.brand.update({ where: { id: brandId }, data: { isActive: activate } });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      actorEmail: admin.email,
      action: activate ? 'brand.activated' : 'brand.deactivated',
      entityType: 'BRAND',
      entityId: brandId,
    },
  });

  revalidatePath('/admin/brands');
}

export async function upsertSettingAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const key = String(formData.get('key') ?? '').trim();
  const value = String(formData.get('value') ?? '').trim();
  if (!key) return;

  const existing = await prisma.setting.findUnique({ where: { key } });
  const before = existing?.value ?? null;

  await prisma.setting.upsert({
    where: { key },
    create: { key, value, updatedBy: admin.id },
    update: { value, updatedBy: admin.id },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'setting.updated',
      entityType: 'SETTING',
      entityId: key,
      beforeData: before === null ? null : JSON.stringify({ value: before }),
      afterData: JSON.stringify({ value }),
    },
  });

  revalidatePath('/admin/settings');
}
