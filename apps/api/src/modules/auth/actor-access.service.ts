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
    const scopes = actor.role === "supervisor" ? await this.getActiveSupervisorScopes(actor.sub, actor.organizationId) : [];
    if (!this.hasAccess(actor, target, scopes)) {
      if (actor.organizationId !== target.organizationId) {
        throw new UnauthorizedException("Authenticated actor cannot access a different organization.");
      }
      if (actor.role === "field_user") {
        throw new UnauthorizedException("Field users can only act on their own operational records.");
      }
      throw new UnauthorizedException("Supervisor access is outside the allowed operational scope.");
    }
  }

  async assertReadAccess(actor: AuthJwtPayload, target: OperationAccessTarget) {
    await this.assertOperationAccess(actor, target);
  }

  async filterReadable<TItem>(
    actor: AuthJwtPayload | undefined,
    items: TItem[],
    resolveTarget: (item: TItem) => OperationAccessTarget
  ): Promise<TItem[]> {
    if (!actor || actor.role === "admin") {
      return items;
    }

    const scopes = actor.role === "supervisor" ? await this.getActiveSupervisorScopes(actor.sub, actor.organizationId) : [];
    return items.filter((item) => this.hasAccess(actor, resolveTarget(item), scopes));
  }

  private hasAccess(actor: AuthJwtPayload, target: OperationAccessTarget, scopes: SupervisorScope[]) {
    if (actor.organizationId !== target.organizationId) {
      return false;
    }

    if (actor.role === "admin") {
      return true;
    }

    if (actor.role === "field_user") {
      const ownedUserIds = [target.userId, target.assigneeId, target.ownerUserId].filter(Boolean);
      return ownedUserIds.length > 0 && ownedUserIds.every((value) => value === actor.sub);
    }

    if (scopes.some((scope) => scope.type === "organization" && scope.referenceId === target.organizationId)) {
      return true;
    }
    if (target.clientId && scopes.some((scope) => scope.type === "client" && scope.referenceId === target.clientId)) {
      return true;
    }
    if (target.zoneId && scopes.some((scope) => scope.type === "zone" && scope.referenceId === target.zoneId)) {
      return true;
    }
    if (target.provinceId && scopes.some((scope) => scope.type === "province" && scope.referenceId === target.provinceId)) {
      return true;
    }

    return false;
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
