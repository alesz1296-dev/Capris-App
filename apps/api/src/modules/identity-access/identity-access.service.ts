import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  type AccessProfileResponse,
  type AssignSupervisorScopeInput,
  type AssignUserRoleInput,
  canAccessOrganization,
  type CreateUserInput,
  type IdentityAccessBootstrap,
  ROLE_DEFINITIONS,
  getPermissionsForRole,
  type Organization,
  type OrganizationAccessProfile,
  type SupervisorScope,
  type Team,
  type User
} from "@capris/shared";
import { CatalogsService } from "../catalogs/catalogs.service";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class IdentityAccessService {
  constructor(
    private readonly catalogsService: CatalogsService,
    private readonly prisma: PrismaService
  ) {}

  async getOrganizations(): Promise<Organization[]> {
    const organizations = await this.prisma.organization.findMany({ orderBy: { name: "asc" } });
    return organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      defaultLocale: organization.defaultLocale as "en" | "es",
      timezone: organization.timezone,
      active: organization.active
    }));
  }

  async getTeams(): Promise<Team[]> {
    const teams = await this.prisma.team.findMany({ orderBy: { name: "asc" } });
    return teams.map((team) => ({
      id: team.id,
      organizationId: team.organizationId,
      name: team.name,
      leadUserId: team.leadUserId ?? undefined,
      active: team.active
    }));
  }

  async getUsers() {
    const users = await this.prisma.user.findMany({ orderBy: { name: "asc" } });
    return users.map((user) => ({
      ...this.toUser(user),
      permissions: getPermissionsForRole(user.role as User["role"])
    }));
  }

  async getSupervisorScopes(): Promise<SupervisorScope[]> {
    const scopes = await this.prisma.supervisorScope.findMany({
      orderBy: [{ type: "asc" }, { referenceName: "asc" }]
    });

    return scopes.map((scope) => ({
      id: scope.id,
      organizationId: scope.organizationId,
      userId: scope.userId,
      type: scope.type as SupervisorScope["type"],
      referenceId: scope.referenceId,
      referenceName: scope.referenceName,
      active: scope.active
    }));
  }

  async getAccessProfile(id: string): Promise<AccessProfileResponse> {
    const userRecord = await this.prisma.user.findUnique({ where: { id } });

    if (!userRecord) {
      throw new NotFoundException(`User ${id} was not found.`);
    }

    const organizationRecord = await this.prisma.organization.findUnique({
      where: { id: userRecord.organizationId }
    });

    if (!organizationRecord) {
      throw new NotFoundException(`Organization ${userRecord.organizationId} was not found.`);
    }

    const [teamRecord, scopeRecords] = await Promise.all([
      this.prisma.team.findFirst({ where: { leadUserId: userRecord.id } }),
      this.prisma.supervisorScope.findMany({ where: { userId: userRecord.id }, orderBy: { type: "asc" } })
    ]);

    const organization: Organization = {
      id: organizationRecord.id,
      name: organizationRecord.name,
      defaultLocale: organizationRecord.defaultLocale as "en" | "es",
      timezone: organizationRecord.timezone,
      active: organizationRecord.active
    };
    const user = this.toUser(userRecord);
    const team = teamRecord
      ? {
          id: teamRecord.id,
          organizationId: teamRecord.organizationId,
          name: teamRecord.name,
          leadUserId: teamRecord.leadUserId ?? undefined,
          active: teamRecord.active
        }
      : undefined;
    const supervisorScopes = scopeRecords.map((scope) => ({
      id: scope.id,
      organizationId: scope.organizationId,
      userId: scope.userId,
      type: scope.type as SupervisorScope["type"],
      referenceId: scope.referenceId,
      referenceName: scope.referenceName,
      active: scope.active
    }));

    return {
      profile: {
        organization,
        user,
        team,
        supervisorScopes
      } satisfies OrganizationAccessProfile,
      permissions: getPermissionsForRole(user.role),
      roleDefinition: ROLE_DEFINITIONS.find((entry) => entry.id === user.role)
    };
  }

  async getIdentityAccessBootstrap(): Promise<IdentityAccessBootstrap> {
    const [organizations, teams, users, supervisorScopes] = await Promise.all([
      this.getOrganizations(),
      this.getTeams(),
      this.getUsers(),
      this.getSupervisorScopes()
    ]);

    return {
      organizations,
      teams,
      users,
      supervisorScopes,
      roleDefinitions: ROLE_DEFINITIONS
    };
  }

  async createUser(input: CreateUserInput) {
    this.assertRequiredString(input.organizationId, "organizationId");
    this.assertRequiredString(input.name, "name");
    this.assertRequiredString(input.email, "email");

    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId }
    });

    if (!organization) {
      throw new NotFoundException(`Organization ${input.organizationId} was not found.`);
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existing) {
      throw new BadRequestException(`A user with email ${normalizedEmail} already exists.`);
    }

    const userRecord = await this.prisma.user.create({
      data: {
        id: this.createId("user"),
        organizationId: input.organizationId,
        name: input.name.trim(),
        email: normalizedEmail,
        role: input.role,
        locale: input.locale,
        active: input.active ?? true
      }
    });

    const user = this.toUser(userRecord);

    return {
      user,
      permissions: getPermissionsForRole(user.role),
      roleDefinition: ROLE_DEFINITIONS.find((entry) => entry.id === user.role)
    };
  }

  async assignUserRole(id: string, input: AssignUserRoleInput) {
    const userRecord = await this.prisma.user.findUnique({ where: { id } });

    if (!userRecord) {
      throw new NotFoundException(`User ${id} was not found.`);
    }

    const updatedRecord = await this.prisma.user.update({
      where: { id },
      data: { role: input.role }
    });

    if (input.role !== "supervisor") {
      await this.prisma.supervisorScope.updateMany({
        where: { userId: id },
        data: { active: false }
      });
    }

    const user = this.toUser(updatedRecord);

    return {
      user,
      permissions: getPermissionsForRole(user.role),
      roleDefinition: ROLE_DEFINITIONS.find((entry) => entry.id === user.role)
    };
  }

  async assignSupervisorScope(input: AssignSupervisorScopeInput) {
    const userRecord = await this.prisma.user.findUnique({ where: { id: input.userId } });

    if (!userRecord) {
      throw new NotFoundException(`User ${input.userId} was not found.`);
    }

    const actor = {
      organizationId: userRecord.organizationId,
      role: userRecord.role as User["role"]
    };

    if (!canAccessOrganization(actor, input.organizationId)) {
      throw new BadRequestException("Supervisor scope organization must match the user's organization.");
    }

    if (userRecord.role !== "supervisor") {
      throw new BadRequestException(`User ${input.userId} must have the supervisor role to receive scopes.`);
    }

    this.assertRequiredString(input.referenceId, "referenceId");
    this.assertRequiredString(input.referenceName, "referenceName");
    await this.assertValidScopeReference(input);

    const scopeRecord = await this.prisma.supervisorScope.upsert({
      where: {
        userId_organizationId_type_referenceId: {
          userId: input.userId,
          organizationId: input.organizationId,
          type: input.type,
          referenceId: input.referenceId
        }
      },
      update: {
        referenceName: input.referenceName.trim(),
        active: input.active ?? true
      },
      create: {
        id: this.createId("scope"),
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        referenceId: input.referenceId.trim(),
        referenceName: input.referenceName.trim(),
        active: input.active ?? true
      }
    });

    return {
      id: scopeRecord.id,
      organizationId: scopeRecord.organizationId,
      userId: scopeRecord.userId,
      type: scopeRecord.type as SupervisorScope["type"],
      referenceId: scopeRecord.referenceId,
      referenceName: scopeRecord.referenceName,
      active: scopeRecord.active
    };
  }

  private assertRequiredString(value: string, fieldName: string) {
    if (!value || !value.trim()) {
      throw new BadRequestException(`${fieldName} is required.`);
    }
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private async assertValidScopeReference(input: AssignSupervisorScopeInput) {
    if (input.type === "organization") {
      const organization = await this.prisma.organization.findUnique({
        where: { id: input.referenceId }
      });

      if (!organization) {
        throw new NotFoundException(`Organization scope reference ${input.referenceId} was not found.`);
      }
      return;
    }

    if (input.type === "team") {
      const team = await this.prisma.team.findFirst({
        where: { id: input.referenceId, organizationId: input.organizationId }
      });

      if (!team) {
        throw new NotFoundException(`Team scope reference ${input.referenceId} was not found.`);
      }
      return;
    }

    if (input.type === "province") {
      const province = await this.catalogsService.getProvinces();
      if (!province.some((entry) => entry.id === input.referenceId && entry.organizationId === input.organizationId)) {
        throw new NotFoundException(`Province scope reference ${input.referenceId} was not found.`);
      }
      return;
    }

    if (input.type === "zone") {
      const zones = await this.catalogsService.getZones();
      if (!zones.some((entry) => entry.id === input.referenceId && entry.organizationId === input.organizationId)) {
        throw new NotFoundException(`Zone scope reference ${input.referenceId} was not found.`);
      }
      return;
    }

    if (input.type === "client") {
      const clients = await this.catalogsService.getClients();
      if (!clients.some((entry) => entry.id === input.referenceId && entry.organizationId === input.organizationId)) {
        throw new NotFoundException(`Client scope reference ${input.referenceId} was not found.`);
      }
    }
  }

  private toUser(userRecord: {
    id: string;
    organizationId: string;
    name: string;
    email: string;
    role: string;
    locale: string;
    active: boolean;
    googleSubject?: string | null;
    avatarUrl?: string | null;
  }): User {
    return {
      id: userRecord.id,
      organizationId: userRecord.organizationId,
      name: userRecord.name,
      email: userRecord.email,
      role: userRecord.role as User["role"],
      locale: userRecord.locale as User["locale"],
      active: userRecord.active,
      googleSubject: userRecord.googleSubject ?? undefined,
      avatarUrl: userRecord.avatarUrl ?? undefined
    };
  }
}
