import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ClientRequestsController } from "../src/modules/client-requests/client-requests.controller";
import { ClientRequestsService } from "../src/modules/client-requests/client-requests.service";

async function testClientRequestValidation() {
  const controller = new ClientRequestsController({
    createClientRequest: () => {
      throw new Error("Service should not be reached for invalid request payload.");
    }
  } as never);

  assert.throws(
    () =>
      controller.createClientRequest({
        organizationId: "org_capris",
        title: "Missing due date",
        requesterName: "Trade Team",
        ownerUserId: "user_supervisor_001",
        dueDate: "05/08/2026",
        openedAt: "2026-05-08T14:00:00.000Z"
      } as never),
    (error: unknown) => error instanceof BadRequestException && `${error.message}`.includes("date must use YYYY-MM-DD format.")
  );
}

async function testClientRequestReferenceValidation() {
  const service = new ClientRequestsService(
    {
      user: {
        findFirst: async () => null
      }
    } as never,
    {} as never,
    {} as never
  );

  await assert.rejects(
    () =>
      service.createClientRequest({
        organizationId: "org_capris",
        title: "Missing owner",
        requesterName: "Trade Team",
        ownerUserId: "user_supervisor_001",
        dueDate: "2026-05-12",
        openedAt: "2026-05-08T14:00:00.000Z",
        priority: "high"
      }),
    (error: unknown) => error instanceof NotFoundException && `${error.message}`.includes("Owner user_supervisor_001 was not found.")
  );
}

async function testResolvedStatusRequiresTimestamp() {
  const service = new ClientRequestsService(
    {
      clientRequest: {
        findUnique: async () => ({
          id: "request_001",
          organizationId: "org_capris",
          status: "in_progress",
          resolvedAt: null,
          closedAt: null
        }),
        update: async () => {
          throw new Error("Update should not run without resolvedAt.");
        }
      }
    } as never,
    {} as never,
    {} as never
  );

  await assert.rejects(
    () =>
      service.updateClientRequestStatus("request_001", {
        status: "resolved"
      }),
    (error: unknown) => error instanceof BadRequestException && `${error.message}`.includes("resolvedAt is required")
  );
}

async function main() {
  await testClientRequestValidation();
  await testClientRequestReferenceValidation();
  await testResolvedStatusRequiresTimestamp();
  console.log("Client request tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
