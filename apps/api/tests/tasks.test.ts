import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { TasksController } from "../src/modules/tasks/tasks.controller";
import { TasksService } from "../src/modules/tasks/tasks.service";
import { ActorAccessService } from "../src/modules/auth/actor-access.service";

const auditServiceStub = {
  recordAudit: async () => undefined
};

async function testTaskCreationValidation() {
  const controller = new TasksController(
    {
      createTask: () => {
        throw new Error("Service should not be reached for invalid payloads.");
      }
    } as never,
    {
      getActor: () => ({
        sub: "user_admin_001",
        organizationId: "org_capris",
        email: "admin@example.com",
        role: "admin",
        locale: "es",
        name: "Admin User",
        sessionId: "session_1",
        type: "access",
        iat: 1,
        exp: 9999999999
      })
    } as never
  );

  assert.throws(
    () =>
      controller.createTask(
        {
          organizationId: "org_capris",
          title: "Go",
          requesterId: "user_admin_001",
          assigneeId: "user_field_001",
          scheduledFor: "2026/05/08",
          provinceId: "province_san_jose",
          zoneId: "zone_central",
          activityTypeId: "activity_exhibition",
          taskTypeId: "task_visit"
        },
        { auth: {} } as never
      ),
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
    } as never,
    {} as never,
    auditServiceStub as never
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
    } as never,
    {} as never,
    auditServiceStub as never
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
    } as never,
    {} as never,
    auditServiceStub as never
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
    } as never,
    {} as never,
    auditServiceStub as never
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

async function testFieldUserCannotUpdateAnotherUsersTaskStatus() {
  const service = new TasksService(
    {
      task: {
        findUnique: async () => ({
          id: "task_launch_display",
          organizationId: "org_capris",
          title: "Install launch display at Escazu Plaza",
          requesterId: "user_admin_001",
          assigneeId: "user_field_999",
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
          throw new Error("Task update should not run for another user's task.");
        }
      }
    } as never,
    {} as never,
    {} as never,
    {
      assertTaskCompletionRequirements: async () => undefined
    } as never,
    new ActorAccessService({
      supervisorScope: {
        findMany: async () => []
      }
    } as never),
    auditServiceStub as never
  );

  await assert.rejects(
    () =>
      service.updateTaskStatus(
        "task_launch_display",
        {
          status: "completed"
        },
        {
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
        }
      ),
    (error: unknown) =>
      error instanceof UnauthorizedException &&
      `${error.message}`.includes("Field users can only")
  );
}

async function testSupervisorCanCompleteTaskInsideScope() {
  const actorAccessService = new ActorAccessService({
    supervisorScope: {
      findMany: async () => [
        {
          id: "scope_1",
          organizationId: "org_capris",
          userId: "user_supervisor_001",
          type: "province",
          referenceId: "province_san_jose",
          referenceName: "San Jose",
          active: true
        }
      ]
    }
  } as never);

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
    } as never,
    actorAccessService,
    auditServiceStub as never
  );

  const result = await service.updateTaskStatus(
    "task_launch_display",
    {
      status: "completed"
    },
    {
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
    }
  );

  assert.equal(result.item.status, "completed");
}

async function main() {
  await testTaskCreationValidation();
  await testTaskReferenceValidation();
  await testAllowedStatusTransition();
  await testDisallowedStatusTransition();
  await testCompletionRequiresEvidence();
  await testFieldUserCannotUpdateAnotherUsersTaskStatus();
  await testSupervisorCanCompleteTaskInsideScope();
  console.log("Task tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
