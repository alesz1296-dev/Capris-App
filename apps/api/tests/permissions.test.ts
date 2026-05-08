import "reflect-metadata";
import assert from "node:assert/strict";
import { canAccessScopedResource, hasPermission } from "@capris/shared";

async function testSupervisorScopeAccess() {
  const allowed = canAccessScopedResource(
    {
      organizationId: "org_capris",
      role: "supervisor",
      supervisorScopes: [
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
    },
    "province",
    "province_san_jose",
    "org_capris"
  );

  const denied = canAccessScopedResource(
    {
      organizationId: "org_capris",
      role: "supervisor",
      supervisorScopes: []
    },
    "province",
    "province_alajuela",
    "org_capris"
  );

  assert.equal(allowed, true);
  assert.equal(denied, false);
  assert.equal(hasPermission("field_user", "catalogs.manage"), false);
}

async function main() {
  await testSupervisorScopeAccess();
  console.log("Permissions tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
