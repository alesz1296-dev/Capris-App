import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConsignationsController } from "../src/modules/consignations/consignations.controller";
import { ConsignationsService } from "../src/modules/consignations/consignations.service";

async function testPrepareValidation() {
  const controller = new ConsignationsController({
    prepareConsignation: () => {
      throw new Error("Service should not be reached for invalid consignation payloads.");
    }
  } as never);

  assert.throws(
    () =>
      controller.prepareConsignation({
        organizationId: "org_capris",
        taskId: "task_launch_display",
        userId: "user_field_001",
        preparedAt: "2026/05/08"
      }),
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
    } as never
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
    } as never
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
    } as never
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
    } as never
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

async function main() {
  await testPrepareValidation();
  await testPrepareReferenceValidation();
  await testSendAlreadySentValidation();
  await testReviewRequiresUploadedBeforeEvidence();
  await testFailSentConsignationValidation();
  console.log("Consignations tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
