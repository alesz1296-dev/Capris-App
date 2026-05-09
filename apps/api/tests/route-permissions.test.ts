import "reflect-metadata";
import assert from "node:assert/strict";
import { REQUIRED_PERMISSIONS_KEY } from "../src/modules/auth/require-permission.decorator";
import { ActivitiesController } from "../src/modules/activations/activations.controller";
import { CalendarController } from "../src/modules/calendar/calendar.controller";
import { CatalogsController } from "../src/modules/catalogs/catalogs.controller";
import { ClientRequestsController } from "../src/modules/client-requests/client-requests.controller";
import { ConsignationsController } from "../src/modules/consignations/consignations.controller";
import { EvidenceController } from "../src/modules/evidence/evidence.controller";
import { ExhibitionsController } from "../src/modules/exhibitions/exhibitions.controller";
import { NotesController } from "../src/modules/notes/notes.controller";
import { VisitsController } from "../src/modules/visits/visits.controller";

type ControllerMethod = {
  controller: Function & { prototype: object };
  method: string;
  permissions: string[];
};

const protectedDomainRoutes: ControllerMethod[] = [
  { controller: VisitsController, method: "getBootstrap", permissions: ["visits.view"] },
  { controller: VisitsController, method: "getVisits", permissions: ["visits.view"] },
  { controller: VisitsController, method: "getVisit", permissions: ["visits.view"] },
  { controller: VisitsController, method: "createVisit", permissions: ["visits.manage"] },
  { controller: VisitsController, method: "checkInVisit", permissions: ["visits.perform"] },
  { controller: VisitsController, method: "checkOutVisit", permissions: ["visits.perform"] },
  { controller: EvidenceController, method: "getBootstrap", permissions: ["evidence.view"] },
  { controller: EvidenceController, method: "getEvidence", permissions: ["evidence.view"] },
  { controller: EvidenceController, method: "createEvidence", permissions: ["evidence.upload"] },
  { controller: EvidenceController, method: "uploadCapturedEvidence", permissions: ["evidence.upload"] },
  { controller: EvidenceController, method: "updateMediaUploadStatus", permissions: ["evidence.upload"] },
  { controller: EvidenceController, method: "requestMediaRetry", permissions: ["evidence.upload"] },
  { controller: NotesController, method: "getComments", permissions: ["notes.view"] },
  { controller: NotesController, method: "getObservations", permissions: ["notes.view"] },
  { controller: NotesController, method: "createComment", permissions: ["notes.manage"] },
  { controller: NotesController, method: "createObservation", permissions: ["notes.manage"] },
  { controller: ConsignationsController, method: "getConsignations", permissions: ["consignations.view"] },
  { controller: ConsignationsController, method: "prepareConsignation", permissions: ["consignations.review_send"] },
  { controller: ConsignationsController, method: "reviewConsignation", permissions: ["consignations.review_send"] },
  { controller: ConsignationsController, method: "sendConsignation", permissions: ["consignations.review_send"] },
  { controller: ConsignationsController, method: "failConsignation", permissions: ["consignations.review_send"] },
  { controller: ActivitiesController, method: "getActivities", permissions: ["activities.view"] },
  { controller: ActivitiesController, method: "createActivity", permissions: ["activities.manage"] },
  { controller: ExhibitionsController, method: "getExhibitions", permissions: ["exhibitions.view"] },
  { controller: ExhibitionsController, method: "createExhibition", permissions: ["exhibitions.manage"] },
  { controller: ClientRequestsController, method: "getBootstrap", permissions: ["client_requests.view"] },
  { controller: ClientRequestsController, method: "getRequests", permissions: ["client_requests.view"] },
  { controller: ClientRequestsController, method: "createClientRequest", permissions: ["client_requests.manage"] },
  { controller: ClientRequestsController, method: "updateClientRequest", permissions: ["client_requests.manage"] },
  { controller: ClientRequestsController, method: "updateClientRequestStatus", permissions: ["client_requests.manage"] },
  { controller: CalendarController, method: "getBootstrap", permissions: ["calendar.view"] },
  { controller: CalendarController, method: "getAgendaEvents", permissions: ["calendar.view"] },
  { controller: CalendarController, method: "createAgendaEvent", permissions: ["calendar.manage"] },
  { controller: CalendarController, method: "updateAgendaEvent", permissions: ["calendar.manage"] },
  { controller: CatalogsController, method: "getPointsOfSale", permissions: ["tasks.assign"] },
  { controller: CatalogsController, method: "getPointOfSale", permissions: ["tasks.assign"] },
  { controller: CatalogsController, method: "createPointOfSale", permissions: ["tasks.assign"] },
  { controller: CatalogsController, method: "updatePointOfSale", permissions: ["tasks.assign"] },
  { controller: CatalogsController, method: "archivePointOfSale", permissions: ["tasks.assign"] }
];

function readRequiredPermissions(route: ControllerMethod) {
  const handler = (route.controller.prototype as Record<string, unknown>)[route.method];
  assert.equal(typeof handler, "function", `${route.method} should be a controller method.`);
  return Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, handler as object);
}

async function testDomainRoutesDeclarePermissions() {
  for (const route of protectedDomainRoutes) {
    assert.deepEqual(
      readRequiredPermissions(route),
      route.permissions,
      `${route.controller.name}.${route.method} should declare ${route.permissions.join(", ")}.`
    );
  }
}

async function main() {
  await testDomainRoutesDeclarePermissions();
  console.log("Route permission metadata tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
