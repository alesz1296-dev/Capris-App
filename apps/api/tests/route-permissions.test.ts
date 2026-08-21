import "reflect-metadata";
import assert from "node:assert/strict";
import { IS_PUBLIC_KEY } from "../src/modules/auth/public.decorator";
import { REQUIRED_PERMISSIONS_KEY } from "../src/modules/auth/require-permission.decorator";
import { ActivitiesController } from "../src/modules/activations/activations.controller";
import { AdminConfigController } from "../src/modules/admin-config/admin-config.controller";
import { AuthController } from "../src/modules/auth/auth.controller";
import { CalendarController } from "../src/modules/calendar/calendar.controller";
import { CatalogsController } from "../src/modules/catalogs/catalogs.controller";
import { ClientRequestsController } from "../src/modules/client-requests/client-requests.controller";
import { ConsignationsController } from "../src/modules/consignations/consignations.controller";
import { EvidenceController } from "../src/modules/evidence/evidence.controller";
import { ExceptionsController } from "../src/modules/exceptions/exceptions.controller";
import { ExhibitionsController } from "../src/modules/exhibitions/exhibitions.controller";
import { FieldOperationsController } from "../src/modules/field-operations/field-operations.controller";
import { IdentityAccessController } from "../src/modules/identity-access/identity-access.controller";
import { NotesController } from "../src/modules/notes/notes.controller";
import { ObjectStorageController } from "../src/modules/object-storage/object-storage.controller";
import { MetricsController } from "../src/modules/system-health/metrics.controller";
import { SystemHealthController } from "../src/modules/system-health/system-health.controller";
import { TasksController } from "../src/modules/tasks/tasks.controller";
import { VisitsController } from "../src/modules/visits/visits.controller";

type ControllerMethod = {
  controller: Function & { prototype: object };
  method: string;
};

type ProtectedRoute = ControllerMethod & {
  permissions: string[];
};

const publicRoutes: ControllerMethod[] = [
  { controller: AuthController, method: "signInWithGoogle" },
  { controller: AuthController, method: "signInWithEmail" },
  { controller: AuthController, method: "registerWithEmail" },
  { controller: AuthController, method: "refresh" },
  { controller: AuthController, method: "signOut" },
  { controller: SystemHealthController, method: "getHealth" },
  { controller: SystemHealthController, method: "getLiveness" },
  { controller: SystemHealthController, method: "getReadiness" },
  { controller: MetricsController, method: "getMetrics" },
  { controller: ObjectStorageController, method: "getObject" }
];

const permissionProtectedRoutes: ProtectedRoute[] = [
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
  { controller: CalendarController, method: "deleteAgendaEvent", permissions: ["calendar.manage"] },
  { controller: TasksController, method: "createTask", permissions: ["tasks.assign"] },
  { controller: TasksController, method: "updateTask", permissions: ["tasks.assign"] },
  { controller: TasksController, method: "updateTaskStatus", permissions: ["tasks.complete"] },
  { controller: TasksController, method: "deleteTask", permissions: ["tasks.assign"] },
  { controller: FieldOperationsController, method: "dashboard", permissions: ["dashboards.view"] },
  { controller: FieldOperationsController, method: "getPerformanceDashboard", permissions: ["performance.view"] },
  { controller: FieldOperationsController, method: "getPerformanceScorecards", permissions: ["performance.view"] },
  { controller: FieldOperationsController, method: "getReportBootstrap", permissions: ["reports.export"] },
  { controller: FieldOperationsController, method: "exportCsv", permissions: ["reports.export"] },
  { controller: FieldOperationsController, method: "getReportSnapshots", permissions: ["reports.export"] },
  { controller: FieldOperationsController, method: "createReportSnapshot", permissions: ["reports.export"] },
  { controller: AuthController, method: "getDeviceSessions", permissions: ["device_sessions.revoke"] },
  { controller: AuthController, method: "revokeDeviceSession", permissions: ["device_sessions.revoke"] },
  { controller: ExceptionsController, method: "getBootstrap", permissions: ["exceptions.review"] },
  { controller: ExceptionsController, method: "getExceptions", permissions: ["exceptions.review"] },
  { controller: ExceptionsController, method: "reviewException", permissions: ["exceptions.review"] },
  { controller: SystemHealthController, method: "getHealthDetails", permissions: ["system_health.view"] },
  { controller: SystemHealthController, method: "getAppObservability", permissions: ["observability.view"] },
  { controller: IdentityAccessController, method: "getUsers", permissions: ["users.manage"] },
  { controller: IdentityAccessController, method: "getSupervisorScopes", permissions: ["users.manage"] },
  { controller: IdentityAccessController, method: "getAccessProfile", permissions: ["users.manage"] },
  { controller: IdentityAccessController, method: "createUser", permissions: ["users.manage"] },
  { controller: IdentityAccessController, method: "assignUserRole", permissions: ["roles.manage"] },
  { controller: IdentityAccessController, method: "assignSupervisorScope", permissions: ["users.manage"] },
  { controller: AdminConfigController, method: "getBootstrap", permissions: ["catalogs.manage"] },
  { controller: AdminConfigController, method: "runImport", permissions: ["catalogs.manage"] },
  { controller: AdminConfigController, method: "createReminderRule", permissions: ["catalogs.manage"] },
  { controller: AdminConfigController, method: "updateReminderRule", permissions: ["catalogs.manage"] },
  { controller: AdminConfigController, method: "updateSettings", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "getBootstrap", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "getProvinces", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "getProvince", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "createProvince", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "updateProvince", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "archiveProvince", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "getZones", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "getZone", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "createZone", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "updateZone", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "archiveZone", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "getClients", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "getClient", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "createClient", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "updateClient", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "archiveClient", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "getPointsOfSale", permissions: ["tasks.assign"] },
  { controller: CatalogsController, method: "getPointOfSale", permissions: ["tasks.assign"] },
  { controller: CatalogsController, method: "createPointOfSale", permissions: ["tasks.assign"] },
  { controller: CatalogsController, method: "updatePointOfSale", permissions: ["tasks.assign"] },
  { controller: CatalogsController, method: "archivePointOfSale", permissions: ["tasks.assign"] },
  { controller: CatalogsController, method: "getActivityTypes", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "getActivityType", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "createActivityType", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "updateActivityType", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "archiveActivityType", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "getTaskTypes", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "getTaskType", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "createTaskType", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "updateTaskType", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "archiveTaskType", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "getWorkflowRules", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "getWorkflowRule", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "createWorkflowRule", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "updateWorkflowRule", permissions: ["catalogs.manage"] },
  { controller: CatalogsController, method: "archiveWorkflowRule", permissions: ["catalogs.manage"] }
];

const authenticatedRoutes: ControllerMethod[] = [
  { controller: TasksController, method: "getBootstrap" },
  { controller: TasksController, method: "getTasks" },
  { controller: TasksController, method: "getTask" },
  { controller: FieldOperationsController, method: "bootstrap" },
  { controller: IdentityAccessController, method: "getOrganizations" },
  { controller: IdentityAccessController, method: "getTeams" },
  { controller: AuthController, method: "getProfile" },
  { controller: ExceptionsController, method: "createException" }
];

function readHandler(route: ControllerMethod) {
  const handler = (route.controller.prototype as Record<string, unknown>)[route.method];
  assert.equal(typeof handler, "function", `${route.controller.name}.${route.method} should be a controller method.`);
  return handler as object;
}

function readEffectivePermissions(route: ControllerMethod) {
  const handler = readHandler(route);
  const classPermissions = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, route.controller) as string[] | undefined;
  const handlerPermissions = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, handler) as string[] | undefined;
  return handlerPermissions ?? classPermissions ?? [];
}

function isPublicRoute(route: ControllerMethod) {
  const handler = readHandler(route);
  const classPublic = Reflect.getMetadata(IS_PUBLIC_KEY, route.controller) as boolean | undefined;
  const handlerPublic = Reflect.getMetadata(IS_PUBLIC_KEY, handler) as boolean | undefined;
  return Boolean(handlerPublic ?? classPublic);
}

async function testPublicRoutesDeclarePublicMetadata() {
  for (const route of publicRoutes) {
    assert.equal(
      isPublicRoute(route),
      true,
      `${route.controller.name}.${route.method} should be marked public.`
    );
  }
}

async function testPermissionProtectedRoutesDeclarePermissions() {
  for (const route of permissionProtectedRoutes) {
    assert.deepEqual(
      readEffectivePermissions(route),
      route.permissions,
      `${route.controller.name}.${route.method} should declare ${route.permissions.join(", ")}.`
    );
    assert.equal(
      isPublicRoute(route),
      false,
      `${route.controller.name}.${route.method} should not be public.`
    );
  }
}

async function testAuthenticatedRoutesAreNotPublicAndDoNotAccidentallyDeclarePermissions() {
  for (const route of authenticatedRoutes) {
    assert.equal(
      isPublicRoute(route),
      false,
      `${route.controller.name}.${route.method} should require authentication.`
    );
    assert.deepEqual(
      readEffectivePermissions(route),
      [],
      `${route.controller.name}.${route.method} is currently auth-only and should not accidentally declare permissions.`
    );
  }
}

async function main() {
  await testPublicRoutesDeclarePublicMetadata();
  await testPermissionProtectedRoutesDeclarePermissions();
  await testAuthenticatedRoutesAreNotPublicAndDoNotAccidentallyDeclarePermissions();
  console.log("Route permission metadata tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
