import "reflect-metadata";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionGuard } from "../src/modules/auth/permission.guard";

async function testMissingPermissionIsRejected() {
  const reflector = new Reflector();
  const guard = new PermissionGuard(reflector);
  const handler = () => undefined;
  Reflect.defineMetadata("capris:requiredPermissions", ["catalogs.manage"], handler);

  assert.throws(
    () =>
      guard.canActivate({
        getHandler: () => handler,
        getClass: () => class TestClass {},
        switchToHttp: () => ({
          getRequest: () => ({
            auth: {
              role: "supervisor"
            }
          })
        })
      } as never),
    (error: unknown) => error instanceof ForbiddenException && `${error.message}`.includes("Missing permission")
  );
}

async function testGrantedPermissionPasses() {
  const reflector = new Reflector();
  const guard = new PermissionGuard(reflector);
  const handler = () => undefined;
  Reflect.defineMetadata("capris:requiredPermissions", ["reports.export"], handler);

  const result = guard.canActivate({
    getHandler: () => handler,
    getClass: () => class TestClass {},
    switchToHttp: () => ({
      getRequest: () => ({
        auth: {
          role: "admin"
        }
      })
    })
  } as never);

  assert.equal(result, true);
}

async function testFieldUserCannotAccessSupervisorActions() {
  const reflector = new Reflector();
  const guard = new PermissionGuard(reflector);

  for (const permission of ["tasks.assign", "calendar.manage", "consignations.review_send", "client_requests.manage"] as const) {
    const handler = () => undefined;
    Reflect.defineMetadata("capris:requiredPermissions", [permission], handler);

    assert.throws(
      () =>
        guard.canActivate({
          getHandler: () => handler,
          getClass: () => class TestClass {},
          switchToHttp: () => ({
            getRequest: () => ({
              auth: {
                role: "field_user"
              }
            })
          })
        } as never),
      (error: unknown) => error instanceof ForbiddenException && `${error.message}`.includes("Missing permission"),
      `field_user should not be allowed to use ${permission}.`
    );
  }
}

async function testSupervisorCanAccessRoutePlanningActions() {
  const reflector = new Reflector();
  const guard = new PermissionGuard(reflector);

  for (const permission of ["tasks.assign", "calendar.manage", "consignations.review_send", "client_requests.manage"] as const) {
    const handler = () => undefined;
    Reflect.defineMetadata("capris:requiredPermissions", [permission], handler);

    const result = guard.canActivate({
      getHandler: () => handler,
      getClass: () => class TestClass {},
      switchToHttp: () => ({
        getRequest: () => ({
          auth: {
            role: "supervisor"
          }
        })
      })
    } as never);

    assert.equal(result, true, `supervisor should be allowed to use ${permission}.`);
  }
}

async function main() {
  await testMissingPermissionIsRejected();
  await testGrantedPermissionPasses();
  await testFieldUserCannotAccessSupervisorActions();
  await testSupervisorCanAccessRoutePlanningActions();
  console.log("Permission guard tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
