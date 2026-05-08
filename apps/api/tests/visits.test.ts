import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { VisitsController } from "../src/modules/visits/visits.controller";
import { VisitsService } from "../src/modules/visits/visits.service";

async function testVisitCreationValidation() {
  const controller = new VisitsController({
    createVisit: () => {
      throw new Error("Service should not be reached for invalid visit payloads.");
    }
  } as never);

  assert.throws(
    () =>
      controller.createVisit({
        organizationId: "org_capris",
        taskId: "task_launch_display",
        assigneeId: "user_field_001",
        scheduledFor: "2026/05/08",
        provinceId: "province_san_jose",
        zoneId: "zone_central",
        pointOfSaleId: "pos_escazu_001"
      }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      `${error.message}`.includes("scheduledFor must use YYYY-MM-DD format.")
  );
}

async function testVisitReferenceValidation() {
  const service = new VisitsService(
    {
      task: {
        findFirst: async () => null
      },
      user: {
        findFirst: async () => ({ id: "user_field_001" })
      },
      province: {
        findFirst: async () => ({ id: "province_san_jose" })
      },
      zone: {
        findFirst: async () => ({ id: "zone_central" })
      },
      pointOfSale: {
        findFirst: async () => ({ id: "pos_escazu_001" })
      },
      visit: {
        create: async () => {
          throw new Error("Visit should not be created when the task reference is invalid.");
        }
      }
    } as never,
    {} as never,
    {} as never,
    {} as never
  );

  await assert.rejects(
    () =>
      service.createVisit({
        organizationId: "org_capris",
        taskId: "task_launch_display",
        assigneeId: "user_field_001",
        scheduledFor: "2026-05-08",
        provinceId: "province_san_jose",
        zoneId: "zone_central",
        pointOfSaleId: "pos_escazu_001"
      }),
    (error: unknown) =>
      error instanceof NotFoundException &&
      `${error.message}`.includes("Task task_launch_display was not found for the selected visit scope.")
  );
}

async function testAllowedVisitCheckIn() {
  const service = new VisitsService(
    {
      visit: {
        findUnique: async () => ({
          id: "visit_launch_display",
          organizationId: "org_capris",
          taskId: "task_launch_display",
          assigneeId: "user_field_001",
          scheduledFor: "2026-05-08",
          provinceId: "province_san_jose",
          zoneId: "zone_central",
          pointOfSaleId: "pos_escazu_001",
          status: "scheduled",
          checkedInAt: null,
          checkedInLatitude: null,
          checkedInLongitude: null,
          checkedOutAt: null,
          checkedOutLatitude: null,
          checkedOutLongitude: null
        }),
        update: async ({ data }: { data: { status: string; checkedInAt: string } }) => ({
          id: "visit_launch_display",
          organizationId: "org_capris",
          taskId: "task_launch_display",
          assigneeId: "user_field_001",
          scheduledFor: "2026-05-08",
          provinceId: "province_san_jose",
          zoneId: "zone_central",
          pointOfSaleId: "pos_escazu_001",
          status: data.status,
          checkedInAt: data.checkedInAt,
          checkedInLatitude: 9.9186,
          checkedInLongitude: -84.1397,
          checkedOutAt: null,
          checkedOutLatitude: null,
          checkedOutLongitude: null
        })
      }
    } as never,
    {} as never,
    {} as never,
    {} as never
  );

  const result = await service.checkInVisit("visit_launch_display", {
    checkedInAt: "2026-05-08T14:00:00.000Z",
    checkedInLatitude: 9.9186,
    checkedInLongitude: -84.1397
  });

  assert.equal(result.item.status, "checked_in");
  assert.equal(result.item.checkedInAt, "2026-05-08T14:00:00.000Z");
  assert.equal(result.message, "Visit visit_launch_display checked in.");
}

async function testDisallowedVisitCheckOut() {
  const service = new VisitsService(
    {
      visit: {
        findUnique: async () => ({
          id: "visit_launch_display",
          organizationId: "org_capris",
          taskId: "task_launch_display",
          assigneeId: "user_field_001",
          scheduledFor: "2026-05-08",
          provinceId: "province_san_jose",
          zoneId: "zone_central",
          pointOfSaleId: "pos_escazu_001",
          status: "scheduled",
          checkedInAt: null,
          checkedInLatitude: null,
          checkedInLongitude: null,
          checkedOutAt: null,
          checkedOutLatitude: null,
          checkedOutLongitude: null
        }),
        update: async () => {
          throw new Error("Visit update should not run for an invalid check-out transition.");
        }
      }
    } as never,
    {} as never,
    {} as never,
    {} as never
  );

  await assert.rejects(
    () =>
      service.checkOutVisit("visit_launch_display", {
        checkedOutAt: "2026-05-08T15:00:00.000Z",
        checkedOutLatitude: 9.9186,
        checkedOutLongitude: -84.1397
      }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      `${error.message}`.includes("Visit visit_launch_display cannot check out from scheduled.")
  );
}

async function main() {
  await testVisitCreationValidation();
  await testVisitReferenceValidation();
  await testAllowedVisitCheckIn();
  await testDisallowedVisitCheckOut();
  console.log("Visit tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
