import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ExceptionsController } from "../src/modules/exceptions/exceptions.controller";
import { ExceptionsService } from "../src/modules/exceptions/exceptions.service";

const auditServiceStub = {
  recordAudit: async () => undefined
};

async function testExceptionValidation() {
  const controller = new ExceptionsController(
    {
      createException: async () => {
        throw new Error("Service should not be reached for invalid exception payloads.");
      }
    } as never,
    {
      getActor: () => ({
        sub: "user_field_001",
        organizationId: "org_capris",
        email: "field@example.com",
        role: "field_user",
        locale: "es",
        name: "Field User",
        sessionId: "session_1",
        type: "access",
        iat: 1,
        exp: 9999999999
      })
    } as never
  );

  assert.throws(
    () =>
      controller.createException(
        {
          organizationId: "org_capris",
          type: "missing_gps",
          title: "x",
          submittedByUserId: "user_field_001",
          submittedAt: "2026-05-08T14:00:00.000Z"
        } as never,
        {
          auth: {
            sub: "user_field_001",
            role: "field_user"
          }
        } as never
      ),
    (error: unknown) => error instanceof BadRequestException
  );
}

async function testExceptionReferenceValidation() {
  const service = new ExceptionsService(
    {
      user: {
        findFirst: async () => null
      },
      task: {
        findFirst: async () => null
      },
      visit: {
        findFirst: async () => null
      },
      mediaAsset: {
        findFirst: async () => null
      },
      consignation: {
        findFirst: async () => null
      }
    } as never,
    {} as never,
    {} as never,
    auditServiceStub as never
  );

  await assert.rejects(
    () =>
      service.createException({
        organizationId: "org_capris",
        type: "missing_gps",
        title: "Missing GPS on route",
        submittedByUserId: "user_field_001",
        taskId: "task_001",
        submittedAt: "2026-05-08T14:00:00.000Z"
      }),
    (error: unknown) =>
      error instanceof NotFoundException && `${error.message}`.includes("Submitter user_field_001 was not found.")
  );
}

async function testRejectedExceptionRequiresReviewNote() {
  const service = new ExceptionsService(
    {
      exceptionRecord: {
        findUnique: async () => ({
          id: "exception_001",
          organizationId: "org_capris",
          status: "submitted"
        })
      },
      user: {
        findFirst: async () => ({
          id: "user_supervisor_001",
          organizationId: "org_capris",
          role: "supervisor",
          active: true
        })
      }
    } as never,
    {} as never,
    {} as never,
    auditServiceStub as never
  );

  await assert.rejects(
    () =>
      service.reviewException("exception_001", {
        status: "rejected",
        reviewedByUserId: "user_supervisor_001",
        reviewedAt: "2026-05-08T15:00:00.000Z"
      }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      `${error.message}`.includes("reviewNote is required")
  );
}

async function testControllerReviewUsesAuthenticatedReviewer() {
  let capturedInput: unknown;

  const controller = new ExceptionsController(
    {
      reviewException: async (_id: string, input: unknown) => {
        capturedInput = input;
        return { ok: true };
      }
    } as never,
    {
      getActor: () => ({
        sub: "user_supervisor_001",
        organizationId: "org_capris",
        email: "supervisor@example.com",
        role: "supervisor",
        locale: "es",
        name: "Supervisor User",
        sessionId: "session_2",
        type: "access",
        iat: 1,
        exp: 9999999999
      })
    } as never
  );

  await controller.reviewException(
    "exception_001",
    {
      status: "approved",
      reviewedByUserId: "user_other",
      reviewedAt: "2026-05-08T15:00:00.000Z"
    },
    { auth: {} } as never
  );

  assert.deepEqual(capturedInput, {
    status: "approved",
    reviewedByUserId: "user_supervisor_001",
    reviewedAt: "2026-05-08T15:00:00.000Z"
  });
}

async function main() {
  await testExceptionValidation();
  await testExceptionReferenceValidation();
  await testRejectedExceptionRequiresReviewNote();
  await testControllerReviewUsesAuthenticatedReviewer();
  console.log("Exception tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
