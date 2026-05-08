import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { NotesController } from "../src/modules/notes/notes.controller";
import { NotesService } from "../src/modules/notes/notes.service";

async function testCommentValidation() {
  const controller = new NotesController({
    createComment: () => {
      throw new Error("Service should not be reached for invalid comment payloads.");
    }
  } as never);

  assert.throws(
    () =>
      controller.createComment({
        organizationId: "org_capris",
        taskId: "task_launch_display",
        userId: "user_field_001",
        body: "",
        createdAt: "2026-05-08T18:00:00.000Z"
      }),
    (error: unknown) => error instanceof BadRequestException
  );
}

async function testObservationReferenceValidation() {
  const service = new NotesService(
    {
      task: {
        findFirst: async () => null
      },
      user: {
        findFirst: async () => ({ id: "user_field_001" })
      },
      observation: {
        create: async () => {
          throw new Error("Observation should not be created when task is missing.");
        }
      }
    } as never
  );

  await assert.rejects(
    () =>
      service.createObservation({
        organizationId: "org_capris",
        taskId: "task_launch_display",
        userId: "user_field_001",
        body: "Store contact unavailable.",
        createdAt: "2026-05-08T18:00:00.000Z"
      }),
    (error: unknown) => error instanceof NotFoundException && `${error.message}`.includes("Task task_launch_display")
  );
}

async function main() {
  await testCommentValidation();
  await testObservationReferenceValidation();
  console.log("Notes tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
