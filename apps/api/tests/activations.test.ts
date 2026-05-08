import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ActivitiesController } from "../src/modules/activations/activations.controller";
import { ActivitiesService } from "../src/modules/activations/activations.service";

async function testActivityValidation() {
  const controller = new ActivitiesController({
    createActivity: () => {
      throw new Error("Service should not be reached for invalid activity payloads.");
    }
  } as never);

  assert.throws(
    () =>
      controller.createActivity({
        organizationId: "org_capris",
        taskId: "task_launch_display",
        userId: "user_field_001",
        quantity: 0,
        recordedAt: "2026-05-08T18:30:00.000Z"
      }),
    (error: unknown) => error instanceof BadRequestException && `${error.message}`.includes("Too small")
  );
}

async function testActivityReferenceValidation() {
  const service = new ActivitiesService(
    {
      task: {
        findFirst: async () => null
      },
      user: {
        findFirst: async () => ({ id: "user_field_001" })
      }
    } as never
  );

  await assert.rejects(
    () =>
      service.createActivity({
        organizationId: "org_capris",
        taskId: "task_launch_display",
        userId: "user_field_001",
        quantity: 2,
        recordedAt: "2026-05-08T18:30:00.000Z"
      }),
    (error: unknown) => error instanceof NotFoundException && `${error.message}`.includes("Task task_launch_display")
  );
}

async function main() {
  await testActivityValidation();
  await testActivityReferenceValidation();
  console.log("Activities tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
