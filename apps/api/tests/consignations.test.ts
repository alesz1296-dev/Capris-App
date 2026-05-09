import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConsignationsController } from "../src/modules/consignations/consignations.controller";
import { ConsignationsService } from "../src/modules/consignations/consignations.service";

const auditServiceStub = {
  recordAudit: async () => undefined,
  recordEmailLog: async () => ({ id: "email_log_1" }),
  updateEmailLog: async () => undefined,
  recordNotificationLog: async () => undefined
};

const emailServiceStub = {
  send: async () => ({ provider: "postmark", messageId: "msg_1" })
};

const objectStorageStub = {
  createSignedReadPath: (path: string) => path
};

const replayProtectionStub = {
  getCachedResult: async () => null,
  recordResult: async () => undefined
};

async function testPrepareValidation() {
  const controller = new ConsignationsController(
    {
      prepareConsignation: () => {
        throw new Error("Service should not be reached for invalid consignation payloads.");
      }
    } as never,
    { getActor: () => ({ organizationId: "org_capris", sub: "user_field_001" }) } as never
  );

  assert.throws(
    () =>
      controller.prepareConsignation(
        {
          organizationId: "org_capris",
          taskId: "task_launch_display",
          userId: "user_field_001",
          preparedAt: "2026/05/08"
        },
        { auth: {} } as never
      ),
    (error: unknown) => error instanceof BadRequestException
  );
}

async function testPrepareReferenceValidation() {
  const service = new ConsignationsService(
    {
      task: {
        findFirst: async () => null
      },
      user: {
        findFirst: async () => ({ id: "user_field_001" })
      },
      visit: {
        findFirst: async () => ({ id: "visit_launch_display" })
      },
      consignation: {
        create: async () => {
          throw new Error("Consignation should not be created when task is missing.");
        }
      }
    } as never,
    {} as never,
    auditServiceStub as never,
    emailServiceStub as never,
    objectStorageStub as never,
    replayProtectionStub as never
  );

  await assert.rejects(
    () =>
      service.prepareConsignation({
        organizationId: "org_capris",
        taskId: "task_launch_display",
        userId: "user_field_001",
        preparedAt: "2026-05-08T18:00:00.000Z"
      }),
    (error: unknown) => error instanceof NotFoundException && `${error.message}`.includes("Task task_launch_display")
  );
}

async function testPrepareDefaultsToTaskAssignee() {
  const service = new ConsignationsService(
    {
      task: {
        findFirst: async () => ({
          id: "task_launch_display",
          organizationId: "org_capris",
          assigneeId: "user_field_001",
          provinceId: "province_san_jose",
          zoneId: "zone_central",
          clientId: "client_capris"
        })
      },
      user: {
        findFirst: async () => {
          throw new Error("Explicit user lookup should not run when userId is omitted.");
        }
      },
      visit: {
        findFirst: async () => null
      },
      consignation: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          id: "consignation_created",
          organizationId: data.organizationId,
          taskId: data.taskId,
          userId: data.userId,
          visitId: null,
          note: data.note ?? null,
          status: data.status,
          preparedAt: data.preparedAt,
          reviewedAt: null,
          recipientEmails: "",
          emailSubject: null,
          emailBody: null,
          beforeEvidenceId: null,
          afterEvidenceId: null,
          sendFailureReason: null,
          failedAt: null,
          sentAt: null
        })
      }
    } as never,
    {
      assertOperationAccess: async () => undefined
    } as never,
    auditServiceStub as never,
    emailServiceStub as never,
    objectStorageStub as never,
    replayProtectionStub as never
  );

  const result = await service.prepareConsignation(
    {
      organizationId: "org_capris",
      taskId: "task_launch_display",
      preparedAt: "2026-05-08T18:00:00.000Z"
    },
    {
      organizationId: "org_capris",
      sub: "user_supervisor_001",
      email: "supervisor@example.com",
      role: "supervisor",
      locale: "es"
    } as never
  );

  assert.equal(result.item.userId, "user_field_001");
}

async function testSendAlreadySentValidation() {
  const service = new ConsignationsService(
    {
      consignation: {
        findUnique: async () => ({
          id: "consignation_123",
          status: "sent"
        }),
        update: async () => {
          throw new Error("Update should not run for already sent consignation.");
        }
      }
    } as never,
    {} as never,
    auditServiceStub as never,
    emailServiceStub as never,
    objectStorageStub as never,
    replayProtectionStub as never
  );

  await assert.rejects(
    () =>
      service.sendConsignation("consignation_123", {
        sentAt: "2026-05-08T19:00:00.000Z"
      }),
    (error: unknown) => error instanceof BadRequestException && `${error.message}`.includes("already been sent")
  );
}

async function testReviewRequiresUploadedBeforeEvidence() {
  const service = new ConsignationsService(
    {
      consignation: {
        findUnique: async () => ({
          id: "consignation_123",
          organizationId: "org_capris",
          taskId: "task_launch_display",
          visitId: "visit_launch_display"
        }),
        update: async () => {
          throw new Error("Update should not run when evidence has not uploaded.");
        }
      },
      evidencePhoto: {
        findFirst: async () => ({
          id: "evidence_before",
          type: "before",
          mediaAsset: {
            uploadStatus: "failed"
          }
        })
      }
    } as never,
    {} as never,
    auditServiceStub as never,
    emailServiceStub as never,
    objectStorageStub as never,
    replayProtectionStub as never
  );

  await assert.rejects(
    () =>
      service.reviewConsignation("consignation_123", {
        reviewedAt: "2026-05-08T18:20:00.000Z",
        recipientEmails: ["client@example.com"],
        emailSubject: "Consignation evidence",
        emailBody: "Before and after photos attached.",
        beforeEvidenceId: "evidence_before"
      }),
    (error: unknown) =>
      error instanceof BadRequestException && `${error.message}`.includes("must finish uploading before consignation review")
  );
}

async function testFailSentConsignationValidation() {
  const service = new ConsignationsService(
    {
      consignation: {
        findUnique: async () => ({
          id: "consignation_123",
          status: "sent"
        }),
        update: async () => {
          throw new Error("Update should not run for sent consignation.");
        }
      }
    } as never,
    {} as never,
    auditServiceStub as never,
    emailServiceStub as never,
    objectStorageStub as never,
    replayProtectionStub as never
  );

  await assert.rejects(
    () =>
      service.failConsignation("consignation_123", {
        failedAt: "2026-05-08T19:10:00.000Z",
        reason: "SMTP timeout"
      }),
    (error: unknown) =>
      error instanceof BadRequestException && `${error.message}`.includes("cannot be marked as failed")
  );
}

async function testSendConsignationMarksFailureWhenProviderFails() {
  const service = new ConsignationsService(
    {
      consignation: {
        findUnique: async () => ({
          id: "consignation_456",
          organizationId: "org_capris",
          taskId: "task_launch_display",
          userId: "user_field_001",
          visitId: "visit_launch_display",
          status: "ready_to_send",
          recipientEmails: "client@example.com",
          emailSubject: "Consignation evidence",
          emailBody: "Attached evidence",
          beforeEvidenceId: null,
          afterEvidenceId: null
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => ({
          id: "consignation_456",
          organizationId: "org_capris",
          taskId: "task_launch_display",
          userId: "user_field_001",
          visitId: "visit_launch_display",
          note: null,
          status: data.status,
          preparedAt: "2026-05-08T18:00:00.000Z",
          reviewedAt: "2026-05-08T18:20:00.000Z",
          recipientEmails: "client@example.com",
          emailSubject: "Consignation evidence",
          emailBody: "Attached evidence",
          beforeEvidenceId: null,
          afterEvidenceId: null,
          sendFailureReason: data.sendFailureReason ?? null,
          failedAt: data.failedAt ?? null,
          sentAt: data.sentAt ?? null
        })
      },
      evidencePhoto: {
        findMany: async () => []
      }
    } as never,
    {} as never,
    {
      ...auditServiceStub,
      recordEmailLog: async () => ({ id: "email_log_1" })
    } as never,
    {
      send: async () => {
        throw new Error("Provider timeout");
      }
    } as never,
    objectStorageStub as never,
    replayProtectionStub as never
  );

  const result = await service.sendConsignation("consignation_456", {
    sentAt: "2026-05-08T19:00:00.000Z"
  });

  assert.equal(result.item.status, "failed");
  assert.ok(result.message.includes("delivery failed"));
}

async function testSendConsignationMarksSentWhenProviderSucceeds() {
  const service = new ConsignationsService(
    {
      consignation: {
        findUnique: async () => ({
          id: "consignation_789",
          organizationId: "org_capris",
          taskId: "task_launch_display",
          userId: "user_field_001",
          visitId: "visit_launch_display",
          status: "ready_to_send",
          recipientEmails: "client@example.com",
          emailSubject: "Consignation evidence",
          emailBody: "Attached evidence",
          beforeEvidenceId: null,
          afterEvidenceId: null
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => ({
          id: "consignation_789",
          organizationId: "org_capris",
          taskId: "task_launch_display",
          userId: "user_field_001",
          visitId: "visit_launch_display",
          note: null,
          status: data.status,
          preparedAt: "2026-05-08T18:00:00.000Z",
          reviewedAt: "2026-05-08T18:20:00.000Z",
          recipientEmails: "client@example.com",
          emailSubject: "Consignation evidence",
          emailBody: "Attached evidence",
          beforeEvidenceId: null,
          afterEvidenceId: null,
          sendFailureReason: null,
          failedAt: null,
          sentAt: data.sentAt ?? null
        })
      },
      evidencePhoto: {
        findMany: async () => []
      }
    } as never,
    {} as never,
    {
      ...auditServiceStub,
      recordEmailLog: async () => ({ id: "email_log_2" })
    } as never,
    {
      send: async () => ({ provider: "postmark", messageId: "msg_123" })
    } as never,
    objectStorageStub as never,
    replayProtectionStub as never
  );

  const result = await service.sendConsignation("consignation_789", {
    sentAt: "2026-05-08T19:10:00.000Z"
  });

  assert.equal(result.item.status, "sent");
  assert.ok(result.message.includes("sent through postmark"));
}

async function main() {
  await testPrepareValidation();
  await testPrepareReferenceValidation();
  await testPrepareDefaultsToTaskAssignee();
  await testSendAlreadySentValidation();
  await testReviewRequiresUploadedBeforeEvidence();
  await testFailSentConsignationValidation();
  await testSendConsignationMarksFailureWhenProviderFails();
  await testSendConsignationMarksSentWhenProviderSucceeds();
  console.log("Consignations tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
