import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ClientRequestsController } from "../src/modules/client-requests/client-requests.controller";
import { ClientRequestsService } from "../src/modules/client-requests/client-requests.service";

const actorAccessStub = {
  filterReadable: async (_actor: unknown, items: any[], resolveTarget: (item: any) => { zoneId?: string }) =>
    items.filter((item) => resolveTarget(item).zoneId !== "zone_blocked")
};

async function testClientRequestValidation() {
  const controller = new ClientRequestsController(
    {
      createClientRequest: () => {
        throw new Error("Service should not be reached for invalid request payload.");
      }
    } as never,
    { getActor: () => ({ organizationId: "org_capris", sub: "user_supervisor_001", role: "supervisor" }) } as never
  );

  assert.throws(
    () =>
      controller.createClientRequest(
        {
          organizationId: "org_capris",
          title: "Missing due date",
          requesterName: "Trade Team",
          ownerUserId: "user_supervisor_001",
          dueDate: "05/08/2026",
          openedAt: "2026-05-08T14:00:00.000Z"
        } as never,
        { auth: {} } as never
      ),
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

async function testSupervisorReadScopeFiltering() {
  const service = new ClientRequestsService(
    {
      clientRequest: {
        findMany: async () => [
          {
            id: "request_allowed",
            organizationId: "org_capris",
            title: "Allowed Request",
            requesterName: "Trade Team",
            requesterEmail: null,
            ownerUserId: "user_supervisor_001",
            clientId: "client_auto_mercado",
            provinceId: "province_san_jose",
            zoneId: "zone_central",
            pointOfSaleId: null,
            taskId: null,
            status: "open",
            dueDate: "2026-05-12",
            openedAt: "2026-05-08T14:00:00.000Z",
            resolvedAt: null,
            closedAt: null,
            priority: "high"
          },
          {
            id: "request_blocked",
            organizationId: "org_capris",
            title: "Blocked Request",
            requesterName: "Trade Team",
            requesterEmail: null,
            ownerUserId: "user_supervisor_002",
            clientId: "client_blocked",
            provinceId: "province_alajuela",
            zoneId: "zone_blocked",
            pointOfSaleId: null,
            taskId: null,
            status: "open",
            dueDate: "2026-05-12",
            openedAt: "2026-05-08T14:00:00.000Z",
            resolvedAt: null,
            closedAt: null,
            priority: "high"
          }
        ]
      }
    } as never,
    actorAccessStub as never,
    {} as never,
    {} as never
  );

  const requests = await service.getClientRequests({ sub: "user_supervisor_001", organizationId: "org_capris", role: "supervisor" } as never);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.id, "request_allowed");
}

async function main() {
  await testClientRequestValidation();
  await testClientRequestReferenceValidation();
  await testResolvedStatusRequiresTimestamp();
  await testSupervisorReadScopeFiltering();
  console.log("Client request tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
