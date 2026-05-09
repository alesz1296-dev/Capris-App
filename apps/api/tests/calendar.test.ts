import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CalendarController } from "../src/modules/calendar/calendar.controller";
import { CalendarService } from "../src/modules/calendar/calendar.service";

async function testCalendarQueryValidation() {
  const controller = new CalendarController(
    {
      getCalendarBootstrap: () => {
        throw new Error("Service should not be reached for invalid calendar query.");
      }
    } as never,
    {} as never
  );

  assert.throws(
    () =>
      controller.getBootstrap(
        {
          view: "week",
          date: "2026/05/08"
        } as never,
        { auth: {} } as never
      ),
    (error: unknown) => error instanceof BadRequestException && `${error.message}`.includes("date must use YYYY-MM-DD format.")
  );
}

async function testAgendaReferenceValidation() {
  const service = new CalendarService(
    {
      user: {
        findFirst: async ({ where }: { where: { id: string } }) => (where.id === "user_missing" ? null : { id: where.id })
      },
      team: {
        findFirst: async () => ({ id: "team_central" })
      }
    } as never,
    {} as never,
    {} as never
  );

  await assert.rejects(
    () =>
      service.createAgendaEvent({
        organizationId: "org_capris",
        title: "Team planning",
        startAt: "2026-05-08T15:00:00.000Z",
        endAt: "2026-05-08T16:00:00.000Z",
        allDay: false,
        scopeType: "organization",
        createdByUserId: "user_missing"
      }),
    (error: unknown) => error instanceof NotFoundException && `${error.message}`.includes("User user_missing was not found.")
  );
}

async function main() {
  await testCalendarQueryValidation();
  await testAgendaReferenceValidation();
  console.log("Calendar tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
