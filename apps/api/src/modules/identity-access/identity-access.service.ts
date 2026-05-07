import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  type AccessProfileResponse,
  type AssignSupervisorScopeInput,
  type AssignUserRoleInput,
  type CreateUserInput,
  DEFAULT_TIMEZONE,
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

@Injectable()
export class IdentityAccessService {
  constructor(private readonly catalogsService: CatalogsService) {}

  private readonly organizations: Organization[] = [
    {
      id: "org_capris",
      name: "Capris Costa Rica",
      defaultLocale: "es",
      timezone: DEFAULT_TIMEZONE,
      active: true
    }
  ];

  private readonly teams: Team[] = [
    {
      id: "team_central",
      organizationId: "org_capris",
      name: "Central Route Team",
      leadUserId: "user_supervisor_001",
      active: true
    }
  ];

  private readonly users: User[] = [
    {
      id: "user_admin_001",
      organizationId: "org_capris",
      name: "Maria Solis",
      email: "maria.solis@capris.example",
      role: "admin",
      locale: "es",
      active: true
    },
    {
      id: "user_supervisor_001",
      organizationId: "org_capris",
      name: "Daniel Rojas",
      email: "daniel.rojas@capris.example",
      role: "supervisor",
      locale: "es",
      active: true
    },
    {
      id: "user_field_001",
      organizationId: "org_capris",
      name: "Lucia Vargas",
      email: "lucia.vargas@capris.example",
      role: "field_user",
      locale: "en",
      active: true
    }
  ];

  private readonly supervisorScopes: SupervisorScope[] = [
    {
      id: "scope_org_capris",
      organizationId: "org_capris",
      userId: "user_supervisor_001",
      type: "organization",
      referenceId: "org_capris",
      referenceName: "Capris Costa Rica",
      active: true
    },
    {
      id: "scope_team_central",
      organizationId: "org_capris",
      userId: "user_supervisor_001",
      type: "team",
      referenceId: "team_central",
      referenceName: "Central Route Team",
      active: true
    },
    {
      id: "scope_province_san_jose",
      organizationId: "org_capris",
      userId: "user_supervisor_001",
      type: "province",
      referenceId: "province_san_jose",
      referenceName: "San Jose",
      active: true
    }
  ];

  getOrganizations() {
    return this.organizations;
  }

  getTeams() {
    return this.teams;
  }

  getUsers() {
    return this.users.map((user) => ({
      ...user,
      permissions: getPermissionsForRole(user.role)
    }));
  }

  getSupervisorScopes() {
    return this.supervisorScopes;
  }

  getAccessProfile(id: string): AccessProfileResponse {
    const user = this.users.find((entry) => entry.id === id);

    if (!user) {
      throw new NotFoundException(`User ${id} was not found.`);
    }

    const organization = this.organizations.find((entry) => entry.id === user.organizationId);

    if (!organization) {
      throw new NotFoundException(`Organization ${user.organizationId} was not found.`);
    }

    const team = this.teams.find((entry) => entry.leadUserId === user.id);
    const supervisorScopes = this.supervisorScopes.filter((entry) => entry.userId === user.id);

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

  getIdentityAccessBootstrap(): IdentityAccessBootstrap {
    return {
      organizations: this.getOrganizations(),
      teams: this.getTeams(),
      users: this.getUsers(),
      supervisorScopes: this.getSupervisorScopes(),
      roleDefinitions: ROLE_DEFINITIONS
    };
  }

  createUser(input: CreateUserInput) {
    this.assertRequiredString(input.organizationId, "organizationId");
    this.assertRequiredString(input.name, "name");
    this.assertRequiredString(input.email, "email");

    const organization = this.organizations.find((entry) => entry.id === input.organizationId);

    if (!organization) {
      throw new NotFoundException(`Organization ${input.organizationId} was not found.`);
    }

    const normalizedEmail = input.email.trim().toLowerCase();

    if (this.users.some((entry) => entry.email.toLowerCase() === normalizedEmail)) {
      throw new BadRequestException(`A user with email ${normalizedEmail} already exists.`);
    }

    const user: User = {
      id: this.createId("user"),
      organizationId: input.organizationId,
      name: input.name.trim(),
      email: normalizedEmail,
      role: input.role,
      locale: input.locale,
      active: input.active ?? true
    };

    this.users.push(user);

    return {
      user,
      permissions: getPermissionsForRole(user.role),
      roleDefinition: ROLE_DEFINITIONS.find((entry) => entry.id === user.role)
    };
  }

  assignUserRole(id: string, input: AssignUserRoleInput) {
    const user = this.users.find((entry) => entry.id === id);

    if (!user) {
      throw new NotFoundException(`User ${id} was not found.`);
    }

    user.role = input.role;

    if (input.role !== "supervisor") {
      this.supervisorScopes.forEach((scope) => {
        if (scope.userId === user.id) {
          scope.active = false;
        }
      });
    }

    return {
      user,
      permissions: getPermissionsForRole(user.role),
      roleDefinition: ROLE_DEFINITIONS.find((entry) => entry.id === user.role)
    };
  }

  assignSupervisorScope(input: AssignSupervisorScopeInput) {
    const user = this.users.find((entry) => entry.id === input.userId);

    if (!user) {
      throw new NotFoundException(`User ${input.userId} was not found.`);
    }

    if (user.role !== "supervisor") {
      throw new BadRequestException(`User ${input.userId} must have the supervisor role to receive scopes.`);
    }

    if (user.organizationId !== input.organizationId) {
      throw new BadRequestException("Supervisor scope organization must match the user's organization.");
    }

    this.assertRequiredString(input.referenceId, "referenceId");
    this.assertRequiredString(input.referenceName, "referenceName");
    this.assertValidScopeReference(input);

    const existingScope = this.supervisorScopes.find(
      (entry) =>
        entry.userId === input.userId &&
        entry.organizationId === input.organizationId &&
        entry.type === input.type &&
        entry.referenceId === input.referenceId
    );

    if (existingScope) {
      existingScope.referenceName = input.referenceName.trim();
      existingScope.active = input.active ?? true;
      return existingScope;
    }

    const scope: SupervisorScope = {
      id: this.createId("scope"),
      organizationId: input.organizationId,
      userId: input.userId,
      type: input.type,
      referenceId: input.referenceId.trim(),
      referenceName: input.referenceName.trim(),
      active: input.active ?? true
    };

    this.supervisorScopes.push(scope);
    return scope;
  }

  private assertRequiredString(value: string, fieldName: string) {
    if (!value || !value.trim()) {
      throw new BadRequestException(`${fieldName} is required.`);
    }
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private assertValidScopeReference(input: AssignSupervisorScopeInput) {
    if (input.type === "organization") {
      const organization = this.organizations.find((entry) => entry.id === input.referenceId);
      if (!organization) {
        throw new NotFoundException(`Organization scope reference ${input.referenceId} was not found.`);
      }
      return;
    }

    if (input.type === "team") {
      const team = this.teams.find(
        (entry) => entry.id === input.referenceId && entry.organizationId === input.organizationId
      );
      if (!team) {
        throw new NotFoundException(`Team scope reference ${input.referenceId} was not found.`);
      }
      return;
    }

    if (input.type === "province") {
      const province = this.catalogsService
        .getProvinces()
        .find((entry) => entry.id === input.referenceId && entry.organizationId === input.organizationId);
      if (!province) {
        throw new NotFoundException(`Province scope reference ${input.referenceId} was not found.`);
      }
      return;
    }

    if (input.type === "zone") {
      const zone = this.catalogsService
        .getZones()
        .find((entry) => entry.id === input.referenceId && entry.organizationId === input.organizationId);
      if (!zone) {
        throw new NotFoundException(`Zone scope reference ${input.referenceId} was not found.`);
      }
      return;
    }

    if (input.type === "client") {
      const client = this.catalogsService
        .getClients()
        .find((entry) => entry.id === input.referenceId && entry.organizationId === input.organizationId);
      if (!client) {
        throw new NotFoundException(`Client scope reference ${input.referenceId} was not found.`);
      }
    }
  }
}
