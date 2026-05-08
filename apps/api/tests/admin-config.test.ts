import "reflect-metadata";
import assert from "node:assert/strict";
import { AdminConfigService } from "../src/modules/admin-config/admin-config.service";

function createService(overrides: Record<string, any> = {}) {
  return new AdminConfigService(
    {
      reminderRule: {
        findMany: async () => [],
        create: async ({ data }: { data: any }) => ({ ...data }),
        findUnique: async () => null,
        update: async ({ data }: { data: any }) => ({ id: "reminder_001", organizationId: "org_capris", ...data })
      },
      adminSettings: {
        findUnique: async () => null,
        upsert: async ({ create }: { create: any }) => create
      },
      user: {
        findUnique: async ({ where }: { where: { email?: string } }) =>
          where.email === "existing@example.com"
            ? {
                id: "user_existing_001",
                email: "existing@example.com"
              }
            : null,
        update: async () => ({}),
        create: async () => ({})
      },
      client: {
        findFirst: async () => null,
        create: async () => ({}),
        update: async () => ({})
      },
      province: {
        findFirst: async ({ where }: { where?: { code?: string } }) =>
          where?.code === "SJ" ? { id: "province_san_jose", code: "SJ" } : null,
        create: async () => ({}),
        update: async () => ({})
      },
      zone: {
        findFirst: async ({ where }: { where?: { code?: string } }) =>
          where?.code === "CENTRAL" ? { id: "zone_central", code: "CENTRAL" } : null,
        create: async () => ({}),
        update: async () => ({})
      },
      pointOfSale: {
        findFirst: async () => null,
        create: async () => ({}),
        update: async () => ({})
      },
      activityType: {
        findFirst: async () => null,
        create: async () => ({}),
        update: async () => ({})
      },
      taskType: {
        findFirst: async () => null,
        create: async () => ({}),
        update: async () => ({})
      },
      ...overrides
    } as never,
    {} as never,
    {} as never
  );
}

async function testUserImportReportsFailures() {
  const service = createService();
  const result = await service.runImport({
    organizationId: "org_capris",
    entityType: "users",
    csvContent: "name,email,role,locale,active\nAndrea,existing@example.com,field_user,es,true\nBad Row,,field_user,es,true"
  });

  assert.equal(result.updatedCount, 1);
  assert.equal(result.failedCount, 1);
  assert.equal(result.failures[0]?.rowNumber, 3);
}

async function testZoneImportRequiresProvinceCode() {
  const service = createService({
    province: {
      findFirst: async () => null
    }
  });

  const result = await service.runImport({
    organizationId: "org_capris",
    entityType: "zones",
    csvContent: "name,code,provinceCode\nCentral,CENTRAL,SJ"
  });

  assert.equal(result.failedCount, 1);
  assert.ok(result.failures[0]?.reason.includes("Province code SJ was not found."));
}

async function testUpdateSettingsPersistsRecipients() {
  const service = createService();
  const result = await service.updateSettings({
    organizationId: "org_capris",
    defaultRecipientEmails: ["ops@example.com", "trade@example.com"],
    retentionPhotoDays: 365,
    retentionGpsDays: 180,
    retentionAuditDays: 730
  });

  assert.equal(result.item.defaultRecipientEmails.length, 2);
  assert.equal(result.item.retentionAuditDays, 730);
}

async function main() {
  await testUserImportReportsFailures();
  await testZoneImportRequiresProvinceCode();
  await testUpdateSettingsPersistsRecipients();
  console.log("Admin config tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
