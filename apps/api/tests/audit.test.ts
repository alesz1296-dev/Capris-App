import "reflect-metadata";
import assert from "node:assert/strict";
import { AuthService } from "../src/modules/auth/auth.service";
import { AuthTokenService } from "../src/modules/auth/auth-token.service";
import { ConsignationsService } from "../src/modules/consignations/consignations.service";
import { FieldOperationsService } from "../src/modules/field-operations/field-operations.service";

process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

async function testAuthWritesAuditLog() {
  const auditCalls: Array<Record<string, unknown>> = [];
  const service = new AuthService(
    {
      user: {
        findFirst: async () => ({
          id: "user_field_001",
          organizationId: "org_capris",
          name: "Andrea Rojas",
          email: "andrea@example.com",
          role: "field_user",
          locale: "es",
          active: true,
          googleSubject: null,
          avatarUrl: null
        }),
        update: async ({ data }: { data: { googleSubject: string; avatarUrl?: string; lastLoginAt: Date } }) => ({
          id: "user_field_001",
          organizationId: "org_capris",
          name: "Andrea Rojas",
          email: "andrea@example.com",
          role: "field_user",
          locale: "es",
          active: true,
          googleSubject: data.googleSubject,
          avatarUrl: data.avatarUrl ?? null
        })
      },
      deviceSession: {
        create: async ({ data }: { data: { id: string; deviceName?: string | null; expiresAt: Date } }) => ({
          id: data.id,
          organizationId: "org_capris",
          userId: "user_field_001",
          provider: "google",
          deviceName: data.deviceName ?? null,
          expiresAt: data.expiresAt,
          createdAt: new Date("2026-05-08T12:00:00.000Z")
        })
      }
    } as never,
    new AuthTokenService(),
    {
      verifyIdToken: async () => ({
        subject: "google-sub-123",
        email: "andrea@example.com",
        name: "Andrea Rojas",
        locale: "es" as const,
        avatarUrl: "https://example.com/avatar.png"
      })
    } as never,
    {} as never,
    {
      recordAudit: async (input: Record<string, unknown>) => {
        auditCalls.push(input);
      }
    } as never
  );

  await service.signInWithGoogle({
    idToken: "x".repeat(40),
    deviceName: "Chrome"
  });

  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, "auth.google_sign_in");
}

async function testConsignationReviewWritesAuditAndEmailLog() {
  const auditCalls: Array<Record<string, unknown>> = [];
  const emailCalls: Array<Record<string, unknown>> = [];
  const service = new ConsignationsService(
    {
      consignation: {
        findUnique: async () => ({
          id: "consignation_123",
          organizationId: "org_capris",
          taskId: "task_launch_display",
          userId: "user_field_001",
          visitId: "visit_launch_display",
          recipientEmails: "",
          emailSubject: null,
          emailBody: null
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => ({
          id: "consignation_123",
          organizationId: "org_capris",
          taskId: "task_launch_display",
          userId: "user_field_001",
          visitId: "visit_launch_display",
          note: null,
          status: data.status,
          preparedAt: "2026-05-08T18:00:00.000Z",
          reviewedAt: data.reviewedAt,
          recipientEmails: data.recipientEmails,
          emailSubject: data.emailSubject,
          emailBody: data.emailBody,
          beforeEvidenceId: data.beforeEvidenceId ?? null,
          afterEvidenceId: data.afterEvidenceId ?? null,
          sendFailureReason: null,
          failedAt: null,
          sentAt: null
        })
      },
      evidencePhoto: {
        findFirst: async ({ where }: { where: { id: string } }) => ({
          id: where.id,
          type: where.id === "evidence_before" ? "before" : "after",
          mediaAsset: {
            uploadStatus: "uploaded"
          }
        })
      }
    } as never,
    {} as never,
    {
      recordAudit: async (input: Record<string, unknown>) => {
        auditCalls.push(input);
      },
      recordEmailLog: async (input: Record<string, unknown>) => {
        emailCalls.push(input);
      }
    } as never,
    {} as never,
    {
      createSignedReadPath: (path: string) => path
    } as never,
    {
      getCachedResult: async () => null,
      recordResult: async () => undefined
    } as never
  );

  await service.reviewConsignation("consignation_123", {
    reviewedAt: "2026-05-08T18:20:00.000Z",
    recipientEmails: ["client@example.com"],
    emailSubject: "Consignation evidence",
    emailBody: "Before and after photos attached.",
    beforeEvidenceId: "evidence_before",
    afterEvidenceId: "evidence_after"
  });

  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, "consignation.review");
  assert.equal(emailCalls.length, 1);
  assert.equal(emailCalls[0].status, "pending_review");
}

async function testReportSnapshotWritesAuditLog() {
  const auditCalls: Array<Record<string, unknown>> = [];
  const service = new FieldOperationsService(
    {
      visit: {
        findMany: async () => []
      },
      evidencePhoto: {
        findMany: async () => []
      },
      mediaAsset: {
        findMany: async () => []
      },
      activation: {
        findMany: async () => []
      },
      exhibitionInstallation: {
        findMany: async () => []
      },
      consignation: {
        findMany: async () => []
      },
      clientRequest: {
        findMany: async () => []
      },
      reportSnapshot: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          ...data,
          createdAt: new Date("2026-05-08T20:00:00.000Z")
        }),
        findMany: async () => []
      }
    } as never,
    {
      getCatalogBootstrap: async () => ({
        provinces: [],
        zones: [],
        clients: [],
        workflowRules: [],
        pointsOfSale: [],
        activityTypes: [],
        taskTypes: []
      })
    } as never,
    {
      getUsers: async () => []
    } as never,
    {
      getTasks: async () => []
    } as never,
    {
      filterReadable: async (_actor: unknown, items: any[]) => items
    } as never,
    {
      recordAudit: async (input: Record<string, unknown>) => {
        auditCalls.push(input);
      }
    } as never
  );

  await service.createReportSnapshot(
    {
      reportName: "summary",
      locale: "en",
      filters: {}
    },
    {
      sub: "user_admin_001",
      organizationId: "org_capris",
      email: "admin@example.com",
      role: "admin",
      locale: "en",
      name: "Admin User",
      sessionId: "session_1",
      type: "access",
      iat: 1,
      exp: 9999999999
    }
  );

  assert.equal(auditCalls.some((call) => call.action === "report.export_csv"), true);
  assert.equal(auditCalls.some((call) => call.action === "report.create_snapshot"), true);
}

async function main() {
  await testAuthWritesAuditLog();
  await testConsignationReviewWritesAuditAndEmailLog();
  await testReportSnapshotWritesAuditLog();
  console.log("Audit tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
