import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ExhibitionsController } from "../src/modules/exhibitions/exhibitions.controller";
import { ExhibitionsService } from "../src/modules/exhibitions/exhibitions.service";

const replayProtectionStub = {
  getCachedResult: async () => null,
  recordResult: async () => undefined
};

async function testExhibitionValidation() {
  const controller = new ExhibitionsController(
    {
      createExhibition: () => {
        throw new Error("Service should not be reached for invalid exhibition payloads.");
      }
    } as never,
    { getActor: () => ({ organizationId: "org_capris", sub: "user_field_001" }) } as never
  );

  assert.throws(
    () =>
      controller.createExhibition(
        {
          organizationId: "org_capris",
          taskId: "task_launch_display",
          userId: "user_field_001",
          quantity: 0,
          recordedAt: "2026-05-08T18:35:00.000Z"
        },
        { auth: {} } as never
      ),
    (error: unknown) => error instanceof BadRequestException && `${error.message}`.includes("Too small")
  );
}

async function testExhibitionReferenceValidation() {
  const service = new ExhibitionsService(
    {
      task: {
        findFirst: async () => ({ id: "task_launch_display" })
      },
      user: {
        findFirst: async () => null
      }
    } as never,
    {} as never,
    replayProtectionStub as never
  );

  await assert.rejects(
    () =>
      service.createExhibition({
        organizationId: "org_capris",
        taskId: "task_launch_display",
        userId: "user_field_001",
        quantity: 3,
        recordedAt: "2026-05-08T18:35:00.000Z"
      }),
    (error: unknown) => error instanceof NotFoundException && `${error.message}`.includes("User user_field_001")
  );
}

async function main() {
  await testExhibitionValidation();
  await testExhibitionReferenceValidation();
  console.log("Exhibitions tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
