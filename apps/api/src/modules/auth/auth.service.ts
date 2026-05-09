import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import {
  ROLE_DEFINITIONS,
  hasPermission,
  getPermissionsForRole,
  toAuthenticatedUser,
  type AuthProfileResponse,
  type AuthResponse,
  type DeviceSessionBootstrap,
  type DeviceSessionMutationResult,
  type DeviceSessionSummary,
  type GoogleSignInInput,
  type RefreshSessionInput,
  type RevokeDeviceSessionInput,
  type SignOutInput
} from "@capris/shared";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { AuthTokenService } from "./auth-token.service";
import { GoogleIdentityService } from "./google-identity.service";
import { IdentityAccessService } from "../identity-access/identity-access.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: AuthTokenService,
    private readonly googleIdentityService: GoogleIdentityService,
    private readonly identityAccessService: IdentityAccessService,
    private readonly auditService: AuditService
  ) {}

  async signInWithGoogle(input: GoogleSignInInput): Promise<AuthResponse> {
    const googleIdentity = await this.googleIdentityService.verifyIdToken(input.idToken);
    const user = await this.findLinkedUser(googleIdentity.subject, googleIdentity.email);

    if (!user) {
      throw new NotFoundException(`No active Capris user is linked to ${googleIdentity.email}.`);
    }

    if (!user.active) {
      throw new UnauthorizedException(`User ${user.email} is inactive.`);
    }

    if (user.googleSubject && user.googleSubject !== googleIdentity.subject) {
      throw new BadRequestException(`Google sign-in does not match the linked account for ${user.email}.`);
    }

    const linkedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        googleSubject: googleIdentity.subject,
        avatarUrl: googleIdentity.avatarUrl,
        lastLoginAt: new Date()
      }
    });

    const sessionId = this.createId("session");
    const tokens = this.tokenService.issueTokens({
      userId: linkedUser.id,
      organizationId: linkedUser.organizationId,
      email: linkedUser.email,
      role: linkedUser.role as "admin" | "supervisor" | "field_user",
      locale: linkedUser.locale as "en" | "es",
      name: linkedUser.name,
      sessionId
    });

    const sessionRecord = await this.prisma.deviceSession.create({
      data: {
        id: sessionId,
        organizationId: linkedUser.organizationId,
        userId: linkedUser.id,
        provider: "google",
        deviceName: input.deviceName?.trim() || "Web browser",
        refreshTokenHash: this.tokenService.hashToken(tokens.refreshToken),
        expiresAt: new Date(tokens.refreshTokenExpiresAt),
        lastUsedAt: new Date()
      }
    });

    await this.auditService.recordAudit({
      organizationId: linkedUser.organizationId,
      actorUserId: linkedUser.id,
      action: "auth.google_sign_in",
      entityType: "device_session",
      entityId: sessionRecord.id,
      metadata: {
        provider: "google",
        deviceName: sessionRecord.deviceName ?? "Web browser"
      }
    });

    return {
      user: toAuthenticatedUser(this.toUser(linkedUser)),
      tokens,
      session: {
        id: sessionRecord.id,
        provider: "google",
        deviceName: sessionRecord.deviceName ?? undefined,
        createdAt: sessionRecord.createdAt.toISOString(),
        expiresAt: sessionRecord.expiresAt.toISOString()
      }
    };
  }

  async refreshSession(input: RefreshSessionInput): Promise<AuthResponse> {
    const payload = this.tokenService.verifyRefreshToken(input.refreshToken);
    const session = await this.prisma.deviceSession.findUnique({
      where: { id: payload.sessionId },
      include: { user: true }
    });

    if (!session || session.revokedAt || session.refreshTokenHash !== this.tokenService.hashToken(input.refreshToken)) {
      throw new UnauthorizedException("Refresh session is invalid or revoked.");
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Refresh session has expired.");
    }

    if (!session.user.active) {
      throw new UnauthorizedException("User is inactive.");
    }

    const tokens = this.tokenService.issueTokens({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      email: session.user.email,
      role: session.user.role as "admin" | "supervisor" | "field_user",
      locale: session.user.locale as "en" | "es",
      name: session.user.name,
      sessionId: session.id
    });

    const updatedSession = await this.prisma.deviceSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.tokenService.hashToken(tokens.refreshToken),
        expiresAt: new Date(tokens.refreshTokenExpiresAt),
        lastUsedAt: new Date()
      }
    });

    await this.auditService.recordAudit({
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: "auth.refresh_session",
      entityType: "device_session",
      entityId: updatedSession.id,
      metadata: {
        provider: updatedSession.provider
      }
    });

    return {
      user: toAuthenticatedUser(this.toUser(session.user)),
      tokens,
      session: {
        id: updatedSession.id,
        provider: "google",
        deviceName: updatedSession.deviceName ?? undefined,
        createdAt: updatedSession.createdAt.toISOString(),
        expiresAt: updatedSession.expiresAt.toISOString()
      }
    };
  }

  async signOut(input: SignOutInput) {
    const matchingSessions = await this.prisma.deviceSession.findMany({
      where: {
        refreshTokenHash: this.tokenService.hashToken(input.refreshToken),
        revokedAt: null
      }
    });

    await this.prisma.deviceSession.updateMany({
      where: {
        refreshTokenHash: this.tokenService.hashToken(input.refreshToken),
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    for (const session of matchingSessions) {
      await this.auditService.recordAudit({
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: "auth.sign_out",
        entityType: "device_session",
        entityId: session.id
      });
    }

    return {
      success: true
    };
  }

  async getProfile(userId: string, sessionId: string): Promise<AuthProfileResponse> {
    const [user, session] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.deviceSession.findUnique({ where: { id: sessionId } })
    ]);

    if (!user) {
      throw new NotFoundException(`User ${userId} was not found.`);
    }

    if (!session || session.revokedAt) {
      throw new UnauthorizedException("Session is invalid or revoked.");
    }

    return {
      user: toAuthenticatedUser(this.toUser(user)),
      session: {
        id: session.id,
        provider: "google",
        deviceName: session.deviceName ?? undefined,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString()
      }
    };
  }

  async getDeviceSessions(): Promise<DeviceSessionBootstrap> {
    const [sessions, users] = await Promise.all([
      this.prisma.deviceSession.findMany({
        include: { user: true },
        orderBy: [{ revokedAt: "asc" }, { lastUsedAt: "desc" }, { createdAt: "desc" }]
      }),
      this.identityAccessService.getUsers()
    ]);

    return {
      sessions: sessions.map((session: any) => this.toDeviceSessionSummary(session)),
      users: users.map(({ permissions, ...user }: any) => user)
    };
  }

  async revokeDeviceSession(id: string, input: RevokeDeviceSessionInput): Promise<DeviceSessionMutationResult> {
    const [session, revoker] = await Promise.all([
      this.prisma.deviceSession.findUnique({
        where: { id },
        include: { user: true }
      }),
      this.prisma.user.findUnique({ where: { id: input.revokedByUserId } })
    ]);

    if (!session) {
      throw new NotFoundException(`Device session ${id} was not found.`);
    }

    if (!revoker || !revoker.active) {
      throw new NotFoundException(`Revoking user ${input.revokedByUserId} was not found.`);
    }

    if (!hasPermission(revoker.role as "admin" | "supervisor" | "field_user", "device_sessions.revoke")) {
      throw new UnauthorizedException("Only admins can revoke device sessions.");
    }

    if (revoker.organizationId !== session.organizationId) {
      throw new UnauthorizedException("Device session revocation must stay within the same organization.");
    }

    const updated = await this.prisma.deviceSession.update({
      where: { id },
      data: {
        revokedAt: session.revokedAt ?? new Date(input.revokedAt)
      },
      include: { user: true }
    });

    await this.auditService.recordAudit({
      organizationId: updated.organizationId,
      actorUserId: input.revokedByUserId,
      action: "auth.revoke_device_session",
      entityType: "device_session",
      entityId: updated.id,
      metadata: {
        revokedUserId: updated.userId
      }
    });

    return {
      item: this.toDeviceSessionSummary(updated),
      message: `Device session ${updated.id} revoked.`
    };
  }

  getAccessProfile(role: "admin" | "supervisor" | "field_user") {
    return {
      permissions: getPermissionsForRole(role),
      roleDefinition: ROLE_DEFINITIONS.find((definition) => definition.id === role)
    };
  }

  private async findLinkedUser(googleSubject: string, email: string) {
    return this.prisma.user.findFirst({
      where: {
        active: true,
        OR: [{ googleSubject }, { email }]
      }
    });
  }

  private toUser(user: {
    id: string;
    organizationId: string;
    name: string;
    email: string;
    role: string;
    locale: string;
    active: boolean;
    googleSubject: string | null;
    avatarUrl: string | null;
  }) {
    return {
      id: user.id,
      organizationId: user.organizationId,
      name: user.name,
      email: user.email,
      role: user.role as "admin" | "supervisor" | "field_user",
      locale: user.locale as "en" | "es",
      active: user.active,
      googleSubject: user.googleSubject ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined
    };
  }

  private toDeviceSessionSummary(session: {
    id: string;
    organizationId: string;
    userId: string;
    provider: string;
    deviceName: string | null;
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
    lastUsedAt: Date | null;
    user: {
      name: string;
      email: string;
    };
  }): DeviceSessionSummary {
    return {
      id: session.id,
      organizationId: session.organizationId,
      userId: session.userId,
      userName: session.user.name,
      userEmail: session.user.email,
      provider: session.provider,
      deviceName: session.deviceName ?? undefined,
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: session.revokedAt?.toISOString(),
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt?.toISOString(),
      active: !session.revokedAt && session.expiresAt.getTime() > Date.now()
    };
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
