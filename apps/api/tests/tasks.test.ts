import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { TasksController } from "../src/modules/tasks/tasks.controller";
import { TasksService } from "../src/modules/tasks/tasks.service";

async function testTaskCreationValidation() {
  const controller = new TasksController({
    createTask: () => {
      throw new Error("Service should not be reached for invalid payloads.");
    }
  } as never);

  assert.throws(
    () =>
      controller.createTask({
        organizationId: "org_capris",
        title: "Go",
        requesterId: "user_admin_001",
        assigneeId: "user_field_001",
        scheduledFor: "2026/05/08",
        provinceId: "province_san_jose",
        zoneId: "zone_central",
        activityTypeId: "activity_exhibition",
        taskTypeId: "task_visit"
      }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      `${error.message}`.includes("scheduledFor must use YYYY-MM-DD format.")
  );
}

async function testTaskReferenceValidation() {
  const service = new TasksService(
    {
      user: {
        findFirst: async ({ where }: { where: { id: string } }) =>
          where.id === "user_admin_001" ? null : { id: where.id }
      },
      province: {
        findFirst: async () => ({ id: "province_san_jose" })
      },
      zone: {
        findFirst: async () => ({ id: "zone_central" })
      },
      activityType: {
        findFirst: async () => ({ id: "activity_exhibition" })
      },
      taskType: {
        findFirst: async () => ({ id: "task_visit" })
      },
      client: {
        findFirst: async () => ({ id: "client_auto_mercado" })
      },
      pointOfSale: {
        findFirst: async () => ({ id: "pos_escazu_001" })
      },
      task: {
        create: async () => {
          throw new Error("Task should not be created when requester is missing.");
        }
      }
    } as never,
    {} as never,
    {} as never,
    {
      assertTaskCompletionRequirements: async () => undefined
    } as never
  );

  await assert.rejects(
    () =>
      service.createTask({
        organizationId: "org_capris",
        title: "Install launch display at Escazu Plaza",
        requesterId: "user_admin_001",
        assigneeId: "user_field_001",
        scheduledFor: "2026-05-08",
        provinceId: "province_san_jose",
        zoneId: "zone_central",
        clientId: "client_auto_mercado",
        pointOfSaleId: "pos_escazu_001",
        activityTypeId: "activity_exhibition",
        taskTypeId: "task_visit",
        priority: "high",
        difficulty: "standard"
      }),
    (error: unknown) =>
      error instanceof NotFoundException && `${error.message}`.includes("Requester user_admin_001 was not found.")
  );
}

async function testAllowedStatusTransition() {
  const service = new TasksService(
    {
      task: {
        findUnique: async () => ({
          id: "task_launch_display",
          organizationId: "org_capris",
          title: "Install launch display at Escazu Plaza",
          requesterId: "user_admin_001",
          assigneeId: "user_field_001",
          scheduledFor: "2026-05-08",
          provinceId: "province_san_jose",
          zoneId: "zone_central",
          clientId: "client_auto_mercado",
          pointOfSaleId: "pos_escazu_001",
          activityTypeId: "activity_exhibition",
          taskTypeId: "task_visit",
          status: "pending",
          priority: "high",
          difficulty: "standard"
        }),
        update: async ({ data }: { data: { status: string } }) => ({
          id: "task_launch_display",
          organizationId: "org_capris",
          title: "Install launch display at Escazu Plaza",
          requesterId: "user_admin_001",
          assigneeId: "user_field_001",
          scheduledFor: "2026-05-08",
          provinceId: "province_san_jose",
          zoneId: "zone_central",
          clientId: "client_auto_mercado",
          pointOfSaleId: "pos_escazu_001",
          activityTypeId: "activity_exhibition",
          taskTypeId: "task_visit",
          status: data.status,
          priority: "high",
          difficulty: "standard"
        })
      }
    } as never,
    {} as never,
    {} as never,
    {
      assertTaskCompletionRequirements: async () => undefined
    } as never
  );

  const result = await service.updateTaskStatus("task_launch_display", {
    status: "in_progress"
  });

  assert.equal(result.item.status, "in_progress");
  assert.equal(result.message, "Task task_launch_display status updated to in_progress.");
}

async function testDisallowedStatusTransition() {
  const service = new TasksService(
    {
      task: {
        findUnique: async () => ({
          id: "task_launch_display",
          organizationId: "org_capris",
          title: "Install launch display at Escazu Plaza",
          requesterId: "user_admin_001",
          assigneeId: "user_field_001",
          scheduledFor: "2026-05-08",
          provinceId: "province_san_jose",
          zoneId: "zone_central",
          clientId: "client_auto_mercado",
          pointOfSaleId: "pos_escazu_001",
          activityTypeId: "activity_exhibition",
          taskTypeId: "task_visit",
          status: "completed",
          priority: "high",
          difficulty: "standard"
        }),
        update: async () => {
          throw new Error("Update should not be called for invalid transitions.");
        }
      }
    } as never,
    {} as never,
    {} as never,
    {
      assertTaskCompletionRequirements: async () => undefined
    } as never
  );

  await assert.rejects(
    () =>
      service.updateTaskStatus("task_launch_display", {
        status: "in_progress"
      }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      `${error.message}`.includes("Task task_launch_display cannot move from completed to in_progress.")
  );
}

async function testCompletionRequiresEvidence() {
  const service = new TasksService(
    {
      task: {
        findUnique: async () => ({
          id: "task_launch_display",
          organizationId: "org_capris",
          title: "Install launch display at Escazu Plaza",
          requesterId: "user_admin_001",
          assigneeId: "user_field_001",
          scheduledFor: "2026-05-08",
          provinceId: "province_san_jose",
          zoneId: "zone_central",
          clientId: "client_auto_mercado",
          pointOfSaleId: "pos_escazu_001",
          activityTypeId: "activity_exhibition",
          taskTypeId: "task_visit",
          status: "in_progress",
          priority: "high",
          difficulty: "standard"
        }),
        update: async () => {
          throw new Error("Task update should not run when evidence is missing.");
        }
      }
    } as never,
    {} as never,
    {} as never,
    {
      assertTaskCompletionRequirements: async () => {
        throw new BadRequestException(
          "Task task_launch_display cannot be completed until required evidence is uploaded: after."
        );
      }
    } as never
  );

  await assert.rejects(
    () =>
      service.updateTaskStatus("task_launch_display", {
        status: "completed"
      }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      `${error.message}`.includes("required evidence is uploaded: after")
  );
}

async function main() {
  await testTaskCreationValidation();
  await testTaskReferenceValidation();
  await testAllowedStatusTransition();
  await testDisallowedStatusTransition();
  await testCompletionRequiresEvidence();
  console.log("Task tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
