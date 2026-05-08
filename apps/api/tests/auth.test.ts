import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { AuthController } from "../src/modules/auth/auth.controller";
import { AuthService } from "../src/modules/auth/auth.service";
import { AuthTokenService } from "../src/modules/auth/auth-token.service";

process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

async function testAuthControllerValidation() {
  const controller = new AuthController({
    signInWithGoogle: async () => {
      throw new Error("Service should not be reached for invalid auth payloads.");
    }
  } as never);

  await assert.rejects(
    () => controller.signInWithGoogle({ idToken: "short" }),
    (error: unknown) =>
      error instanceof BadRequestException && `${error.message}`.includes("idToken is required.")
  );
}

async function testGoogleSignInLinksExistingUser() {
  const tokenService = new AuthTokenService();
  const service = new AuthService(
    {
      user: {
        findFirst: async () => ({
          id: "user_field_001",
          organizationId: "org_capris",
          name: "Andrea Rojas",
          email: "andrea@example.com",
          role: "field_user",
          locale: "es",
          active: true,
          googleSubject: null,
          avatarUrl: null
        }),
        update: async ({ data }: { data: { googleSubject: string; avatarUrl?: string; lastLoginAt: Date } }) => ({
          id: "user_field_001",
          organizationId: "org_capris",
          name: "Andrea Rojas",
          email: "andrea@example.com",
          role: "field_user",
          locale: "es",
          active: true,
          googleSubject: data.googleSubject,
          avatarUrl: data.avatarUrl ?? null
        }),
        findUnique: async () => null
      },
      deviceSession: {
        create: async ({ data }: { data: { id: string; deviceName?: string | null; expiresAt: Date; createdAt?: Date } }) => ({
          id: data.id,
          deviceName: data.deviceName ?? null,
          expiresAt: data.expiresAt,
          createdAt: new Date("2026-05-08T12:00:00.000Z")
        })
      }
    } as never,
    tokenService,
    {
      verifyIdToken: async () => ({
        subject: "google-sub-123",
        email: "andrea@example.com",
        name: "Andrea Rojas",
        locale: "es" as const,
        avatarUrl: "https://example.com/avatar.png"
      })
    } as never
  );

  const result = await service.signInWithGoogle({
    idToken: "x".repeat(40),
    deviceName: "Chrome"
  });

  assert.equal(result.user.email, "andrea@example.com");
  assert.equal(result.user.googleSubject, "google-sub-123");
  assert.equal(result.session.provider, "google");
  assert.ok(result.tokens.accessToken.length > 20);
  assert.ok(result.tokens.refreshToken.length > 20);
}

async function testGoogleSignInRejectsUnknownUser() {
  const service = new AuthService(
    {
      user: {
        findFirst: async () => null
      }
    } as never,
    new AuthTokenService(),
    {
      verifyIdToken: async () => ({
        subject: "google-sub-456",
        email: "unknown@example.com",
        name: "Unknown User",
        locale: "en" as const
      })
    } as never
  );

  await assert.rejects(
    () => service.signInWithGoogle({ idToken: "y".repeat(40) }),
    (error: unknown) =>
      error instanceof NotFoundException &&
      `${error.message}`.includes("No active Capris user is linked to unknown@example.com.")
  );
}

async function testRefreshSessionRejectsRevokedSession() {
  const tokenService = new AuthTokenService();
  const tokens = tokenService.issueTokens({
    userId: "user_field_001",
    organizationId: "org_capris",
    email: "andrea@example.com",
    role: "field_user",
    locale: "es",
    name: "Andrea Rojas",
    sessionId: "session_auth_001"
  });

  const service = new AuthService(
    {
      deviceSession: {
        findUnique: async () => ({
          id: "session_auth_001",
          revokedAt: new Date("2026-05-08T12:05:00.000Z"),
          refreshTokenHash: tokenService.hashToken(tokens.refreshToken),
          expiresAt: new Date(tokens.refreshTokenExpiresAt),
          user: {
            id: "user_field_001",
            organizationId: "org_capris",
            name: "Andrea Rojas",
            email: "andrea@example.com",
            role: "field_user",
            locale: "es",
            active: true
          }
        })
      }
    } as never,
    tokenService,
    {} as never
  );

  await assert.rejects(
    () => service.refreshSession({ refreshToken: tokens.refreshToken }),
    (error: unknown) =>
      error instanceof UnauthorizedException &&
      `${error.message}`.includes("Refresh session is invalid or revoked.")
  );
}

async function main() {
  await testAuthControllerValidation();
  await testGoogleSignInLinksExistingUser();
  await testGoogleSignInRejectsUnknownUser();
  await testRefreshSessionRejectsRevokedSession();
  console.log("Auth tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
