import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ExceptionsController } from "../src/modules/exceptions/exceptions.controller";
import { ExceptionsService } from "../src/modules/exceptions/exceptions.service";

async function testExceptionValidation() {
  const controller = new ExceptionsController({
    createException: async () => {
      throw new Error("Service should not be reached for invalid exception payloads.");
    }
  } as never);

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
    {} as never
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
    {} as never
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

async function testControllerReviewRequiresSupervisorPermission() {
  const controller = new ExceptionsController({
    reviewException: async () => {
      throw new Error("Service should not be reached without review permission.");
    }
  } as never);

  assert.throws(
    () =>
      controller.reviewException(
        "exception_001",
        {
          status: "approved",
          reviewedByUserId: "user_field_001",
          reviewedAt: "2026-05-08T15:00:00.000Z"
        },
        {
          auth: {
            sub: "user_field_001",
            role: "field_user"
          }
        } as never
      ),
    (error: unknown) => error instanceof UnauthorizedException
  );
}

async function main() {
  await testExceptionValidation();
  await testExceptionReferenceValidation();
  await testRejectedExceptionRequiresReviewNote();
  await testControllerReviewRequiresSupervisorPermission();
  console.log("Exception tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
