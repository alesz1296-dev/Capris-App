import assert from "node:assert/strict";
import { UnauthorizedException } from "@nestjs/common";
import { ActorAccessService } from "../src/modules/auth/actor-access.service";

async function testFieldUserCannotActForAnotherUser() {
  const service = new ActorAccessService({
    supervisorScope: {
      findMany: async () => []
    }
  } as never);

  await assert.rejects(
    () =>
      service.assertOperationAccess(
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
        },
        {
          organizationId: "org_capris",
          userId: "user_field_999"
        }
      ),
    (error: unknown) =>
      error instanceof UnauthorizedException &&
      `${error.message}`.includes("Field users can only act on their own operational records.")
  );
}

async function testSupervisorAuditorNeedsMatchingScope() {
  const service = new ActorAccessService({
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

  await service.assertOperationAccess(
    {
      sub: "user_supervisor_001",
      organizationId: "org_capris",
      email: "supervisor@example.com",
      role: "supervisor_auditor",
      locale: "es",
      name: "Supervisor",
      sessionId: "session_2",
      type: "access",
      iat: 1,
      exp: 9999999999
    },
    {
      organizationId: "org_capris",
      provinceId: "province_san_jose"
    }
  );

  await assert.rejects(
    () =>
      service.assertOperationAccess(
        {
          sub: "user_supervisor_001",
          organizationId: "org_capris",
          email: "supervisor@example.com",
          role: "supervisor_auditor",
          locale: "es",
          name: "Supervisor",
          sessionId: "session_2",
          type: "access",
          iat: 1,
          exp: 9999999999
        },
        {
          organizationId: "org_capris",
          provinceId: "province_alajuela"
        }
      ),
    (error: unknown) =>
      error instanceof UnauthorizedException &&
      `${error.message}`.includes("Supervisor/auditor access is outside the allowed operational scope.")
  );
}

async function main() {
  await testFieldUserCannotActForAnotherUser();
  await testSupervisorAuditorNeedsMatchingScope();
  console.log("Actor access tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
