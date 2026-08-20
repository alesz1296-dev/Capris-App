import "reflect-metadata";
import assert from "node:assert/strict";
import { canAccessScopedResource, hasPermission } from "@capris/shared";

async function testSupervisorScopeAccess() {
  const allowed = canAccessScopedResource(
    {
      organizationId: "org_capris",
      role: "supervisor_auditor",
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
      role: "supervisor_auditor",
      supervisorScopes: []
    },
    "province",
    "province_alajuela",
    "org_capris"
  );

  assert.equal(allowed, true);
  assert.equal(denied, false);
  assert.equal(hasPermission("field_user", "catalogs.manage"), false);
  assert.equal(hasPermission("field_user", "consignations.review_send"), false);
  assert.equal(hasPermission("supervisor_auditor", "consignations.review_send"), true);
  assert.equal(hasPermission("supervisor_auditor", "system_health.view"), false);
  assert.equal(hasPermission("developer_sre", "metrics.view"), true);
  assert.equal(hasPermission("developer_sre", "tasks.assign"), false);
}

async function main() {
  await testSupervisorScopeAccess();
  console.log("Permissions tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
