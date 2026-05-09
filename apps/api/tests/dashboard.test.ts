import "reflect-metadata";
import assert from "node:assert/strict";
import { FieldOperationsService } from "../src/modules/field-operations/field-operations.service";

const auditServiceStub = {
  recordAudit: async () => undefined
};

const actorAccessStub = {
  filterReadable: async (_actor: unknown, items: any[], resolveTarget: (item: any) => { zoneId?: string }) =>
    items.filter((item) => resolveTarget(item).zoneId !== "zone_blocked")
};

async function testDashboardAggregation() {
  const service = new FieldOperationsService(
    {
      visit: {
        findMany: async () => [
          { id: "visit_1", taskId: "task_1", assigneeId: "user_field_001", provinceId: "province_san_jose", zoneId: "zone_central", status: "checked_out", scheduledFor: "2026-05-08" },
          { id: "visit_2", taskId: "task_2", assigneeId: "user_field_001", provinceId: "province_san_jose", zoneId: "zone_central", status: "scheduled", scheduledFor: "2026-05-08" }
        ]
      },
      evidencePhoto: {
        findMany: async () => [{ id: "evidence_1", taskId: "task_1", mediaAssetId: "media_1", type: "before" }]
      },
      mediaAsset: {
        findMany: async () => [{ id: "media_1", uploadStatus: "uploaded", syncState: "synced" }]
      },
      activation: {
        findMany: async () => [{ id: "activity_1", taskId: "task_1", userId: "user_field_001", quantity: 3 }]
      },
      exhibitionInstallation: {
        findMany: async () => [{ id: "exhibition_1", taskId: "task_1", userId: "user_field_001", quantity: 2 }]
      },
      consignation: {
        findMany: async () => [{ id: "cons_1", taskId: "task_1", status: "failed" }]
      },
      clientRequest: {
        findMany: async () => [
          {
            id: "request_1",
            ownerUserId: "user_supervisor_001",
            clientId: "client_auto_mercado",
            provinceId: "province_san_jose",
            zoneId: "zone_central",
            status: "open",
            dueDate: "2026-05-07",
            openedAt: "2026-05-01T14:00:00.000Z"
          }
        ]
      }
    } as never,
    {
      getCatalogBootstrap: async () => ({
        provinces: [{ id: "province_san_jose", name: "San Jose" }],
        zones: [{ id: "zone_central", name: "Central" }],
        clients: [{ id: "client_auto_mercado", name: "Auto Mercado" }],
        workflowRules: [{ organizationId: "org_capris", taskTypeId: "task_visit", activityTypeId: "activity_exhibition", requiresBeforePhoto: true, requiresAfterPhoto: true }],
        pointsOfSale: [],
        activityTypes: [],
        taskTypes: []
      })
    } as never,
    {
      getUsers: async () => [
        { id: "user_field_001", name: "Lucia Vargas", permissions: [] },
        { id: "user_supervisor_001", name: "Daniel Rojas", permissions: [] }
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
        },
        {
          id: "task_2",
          organizationId: "org_capris",
          title: "Task 2",
          requesterId: "user_admin_001",
          assigneeId: "user_field_001",
          scheduledFor: "2026-05-07",
          provinceId: "province_san_jose",
          zoneId: "zone_central",
          clientId: "client_auto_mercado",
          activityTypeId: "activity_exhibition",
          taskTypeId: "task_visit",
          status: "pending",
          priority: "high",
          difficulty: "standard"
        }
      ]
    } as never,
    actorAccessStub as never,
    auditServiceStub as never
  );

  const dashboard = await service.getDashboard("en");
  assert.equal(dashboard.summary.totalTasks, 2);
  assert.equal(dashboard.summary.completedTasks, 1);
  assert.equal(dashboard.summary.pendingTasks, 1);
  assert.equal(dashboard.summary.activitiesCount, 3);
  assert.equal(dashboard.summary.exhibitionsCount, 2);
  assert.equal(dashboard.summary.failedEmails, 1);
  assert.equal(dashboard.productivity.fieldUsers[0]?.completedTasks, 1);
}

async function testDashboardSupervisorScopeFiltering() {
  const service = new FieldOperationsService(
    {
      visit: {
        findMany: async () => [
          { id: "visit_allowed", taskId: "task_allowed", assigneeId: "user_field_001", provinceId: "province_san_jose", zoneId: "zone_central", status: "checked_out", scheduledFor: "2026-05-08" },
          { id: "visit_blocked", taskId: "task_blocked", assigneeId: "user_field_002", provinceId: "province_alajuela", zoneId: "zone_blocked", status: "checked_out", scheduledFor: "2026-05-08" }
        ]
      },
      evidencePhoto: { findMany: async () => [] },
      mediaAsset: { findMany: async () => [] },
      activation: { findMany: async () => [] },
      exhibitionInstallation: { findMany: async () => [] },
      consignation: { findMany: async () => [] },
      clientRequest: {
        findMany: async () => [
          { id: "request_allowed", organizationId: "org_capris", ownerUserId: "user_supervisor_001", clientId: "client_auto_mercado", provinceId: "province_san_jose", zoneId: "zone_central", status: "open", dueDate: "2026-05-07", openedAt: "2026-05-01T14:00:00.000Z" },
          { id: "request_blocked", organizationId: "org_capris", ownerUserId: "user_supervisor_002", clientId: "client_blocked", provinceId: "province_alajuela", zoneId: "zone_blocked", status: "open", dueDate: "2026-05-07", openedAt: "2026-05-01T14:00:00.000Z" }
        ]
      }
    } as never,
    {
      getCatalogBootstrap: async () => ({
        provinces: [{ id: "province_san_jose", name: "San Jose" }, { id: "province_alajuela", name: "Alajuela" }],
        zones: [{ id: "zone_central", name: "Central" }, { id: "zone_blocked", name: "Blocked" }],
        clients: [{ id: "client_auto_mercado", name: "Auto Mercado" }, { id: "client_blocked", name: "Blocked Client" }],
        workflowRules: [],
        pointsOfSale: [],
        activityTypes: [],
        taskTypes: []
      })
    } as never,
    {
      getUsers: async () => [
        { id: "user_field_001", name: "Lucia Vargas", permissions: [] },
        { id: "user_field_002", name: "Blocked User", permissions: [] },
        { id: "user_supervisor_001", name: "Daniel Rojas", permissions: [] }
      ]
    } as never,
    {
      getTasks: async () => [
        {
          id: "task_allowed",
          organizationId: "org_capris",
          title: "Allowed Task",
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
    } as never,
    actorAccessStub as never,
    auditServiceStub as never
  );

  const dashboard = await service.getDashboard("en", { sub: "user_supervisor_001", organizationId: "org_capris", role: "supervisor" } as never);
  assert.equal(dashboard.summary.totalTasks, 1);
  assert.equal(dashboard.summary.totalVisits, 1);
  assert.equal(dashboard.summary.openClientRequests, 1);
}

async function main() {
  await testDashboardAggregation();
  await testDashboardSupervisorScopeFiltering();
  console.log("Dashboard tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
