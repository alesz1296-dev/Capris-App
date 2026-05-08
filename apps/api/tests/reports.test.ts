import "reflect-metadata";
import assert from "node:assert/strict";
import { FieldOperationsService } from "../src/modules/field-operations/field-operations.service";

function createReportsService() {
  return new FieldOperationsService(
    {
      visit: {
        findMany: async () => [
          { id: "visit_1", taskId: "task_1", assigneeId: "user_field_001", provinceId: "province_san_jose", zoneId: "zone_central", status: "checked_out", scheduledFor: "2026-05-08" }
        ]
      },
      evidencePhoto: {
        findMany: async () => [{ id: "evidence_1", taskId: "task_1", mediaAssetId: "media_1", type: "before" }]
      },
      mediaAsset: {
        findMany: async () => [{ id: "media_1", uploadStatus: "uploaded", syncState: "synced", capturedAt: "2026-05-08T14:00:00.000Z" }]
      },
      activation: {
        findMany: async () => [{ id: "activity_1", taskId: "task_1", userId: "user_field_001", quantity: 3, recordedAt: "2026-05-08T15:00:00.000Z" }]
      },
      exhibitionInstallation: {
        findMany: async () => [{ id: "exhibition_1", taskId: "task_1", userId: "user_field_001", quantity: 2, recordedAt: "2026-05-08T15:05:00.000Z" }]
      },
      consignation: {
        findMany: async () => []
      },
      clientRequest: {
        findMany: async () => [
          {
            id: "request_1",
            title: "Need price correction",
            requesterName: "Trade Team",
            ownerUserId: "user_supervisor_001",
            clientId: "client_auto_mercado",
            provinceId: "province_san_jose",
            zoneId: "zone_central",
            status: "open",
            dueDate: "2026-05-08",
            openedAt: "2026-05-01T14:00:00.000Z"
          }
        ]
      },
      reportSnapshot: {
        create: async ({ data }: { data: any }) => ({
          ...data,
          createdAt: new Date("2026-05-08T20:00:00.000Z")
        }),
        findMany: async () => []
      }
    } as never,
    {
      getCatalogBootstrap: async () => ({
        provinces: [{ id: "province_san_jose", name: "San Jose" }],
        zones: [{ id: "zone_central", name: "Central", provinceId: "province_san_jose" }],
        clients: [{ id: "client_auto_mercado", name: "Auto Mercado" }],
        workflowRules: [{ organizationId: "org_capris", taskTypeId: "task_visit", activityTypeId: "activity_exhibition", requiresBeforePhoto: true, requiresAfterPhoto: false }],
        pointsOfSale: [],
        activityTypes: [],
        taskTypes: []
      })
    } as never,
    {
      getUsers: async () => [
        { id: "user_field_001", name: "Lucia Vargas", permissions: [], organizationId: "org_capris", email: "lucia@example.com", role: "field_user", locale: "es", active: true },
        { id: "user_supervisor_001", name: "Daniel Rojas", permissions: [], organizationId: "org_capris", email: "daniel@example.com", role: "supervisor", locale: "es", active: true }
      ]
    } as never,
    {
      getTasks: async () => [
        {
          id: "task_1",
          organizationId: "org_capris",
          title: "Task 1",
          requesterId: "user_admin_001",
          assigneeId: "user_field_001",
          scheduledFor: "2026-05-08",
          provinceId: "province_san_jose",
          zoneId: "zone_central",
          clientId: "client_auto_mercado",
          activityTypeId: "activity_exhibition",
          taskTypeId: "task_visit",
          status: "completed",
          priority: "high",
          difficulty: "standard"
        }
      ]
    } as never
  );
}

async function testLocalizedCsvHeaders() {
  const service = createReportsService();
  const result = await service.exportCsv("summary", "es", {});
  assert.ok(result.csv.includes("Tareas completadas"));
  assert.ok(result.csv.includes("Solicitudes abiertas"));
}

async function testTaskFiltersApplyToCsv() {
  const service = createReportsService();
  const matching = await service.exportCsv("tasks", "en", { userId: "user_field_001" });
  const filteredOut = await service.exportCsv("tasks", "en", { userId: "user_other_001" });
  assert.ok(matching.rowCount > 0);
  assert.equal(filteredOut.rowCount, 0);
}

async function testSnapshotCreationStoresCsv() {
  const service = createReportsService();
  const result = await service.createReportSnapshot({
    reportName: "productivity",
    locale: "en",
    filters: { provinceId: "province_san_jose" }
  });

  assert.equal(result.item.reportName, "productivity");
  assert.equal(result.item.filters.provinceId, "province_san_jose");
  assert.ok(result.item.csv.includes("Dimension"));
}

async function main() {
  await testLocalizedCsvHeaders();
  await testTaskFiltersApplyToCsv();
  await testSnapshotCreationStoresCsv();
  console.log("Report tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
