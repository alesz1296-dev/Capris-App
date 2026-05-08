import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { SupervisorScope } from "@capris/shared";
import { PrismaService } from "../database/prisma.service";
import type { AuthJwtPayload } from "./auth-token.service";
import type { AuthenticatedRequest } from "./jwt-auth.guard";

type ActorAccessPrisma = PrismaService & {
  supervisorScope: any;
};

export interface OperationAccessTarget {
  organizationId: string;
  userId?: string;
  assigneeId?: string;
  ownerUserId?: string;
  provinceId?: string;
  zoneId?: string;
  clientId?: string;
}

@Injectable()
export class ActorAccessService {
  constructor(private readonly prisma: PrismaService) {}

  getActor(request: AuthenticatedRequest): AuthJwtPayload {
    if (!request.auth) {
      throw new UnauthorizedException("Authenticated request context was not found.");
    }

    return request.auth;
  }

  getActorOrganizationId(request: AuthenticatedRequest) {
    return this.getActor(request).organizationId;
  }

  getActorUserId(request: AuthenticatedRequest) {
    return this.getActor(request).sub;
  }

  async assertOperationAccess(actor: AuthJwtPayload, target: OperationAccessTarget) {
    if (actor.organizationId !== target.organizationId) {
      throw new UnauthorizedException("Authenticated actor cannot access a different organization.");
    }

    if (actor.role === "admin") {
      return;
    }

    if (actor.role === "field_user") {
      const ownedUserIds = [target.userId, target.assigneeId, target.ownerUserId].filter(Boolean);
      if (ownedUserIds.some((value) => value !== actor.sub)) {
        throw new UnauthorizedException("Field users can only act on their own operational records.");
      }
      return;
    }

    const scopes = await this.getActiveSupervisorScopes(actor.sub, actor.organizationId);
    if (scopes.some((scope) => scope.type === "organization" && scope.referenceId === target.organizationId)) {
      return;
    }

    if (target.clientId && scopes.some((scope) => scope.type === "client" && scope.referenceId === target.clientId)) {
      return;
    }

    if (target.zoneId && scopes.some((scope) => scope.type === "zone" && scope.referenceId === target.zoneId)) {
      return;
    }

    if (target.provinceId && scopes.some((scope) => scope.type === "province" && scope.referenceId === target.provinceId)) {
      return;
    }

    throw new UnauthorizedException("Supervisor access is outside the allowed operational scope.");
  }

  private async getActiveSupervisorScopes(userId: string, organizationId: string): Promise<SupervisorScope[]> {
    const prisma = this.prisma as unknown as ActorAccessPrisma;
    const scopes = await prisma.supervisorScope.findMany({
      where: {
        userId,
        organizationId,
        active: true
      }
    });

    return scopes.map((scope: any) => ({
      id: scope.id,
      organizationId: scope.organizationId,
      userId: scope.userId,
      type: scope.type as SupervisorScope["type"],
      referenceId: scope.referenceId,
      referenceName: scope.referenceName,
      active: scope.active
    }));
  }
}
