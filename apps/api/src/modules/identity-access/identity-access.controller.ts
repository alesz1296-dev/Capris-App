import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import type { AssignSupervisorScopeInput, AssignUserRoleInput, CreateUserInput } from "@capris/shared";
import { RequirePermissions } from "../auth/require-permission.decorator";
import { IdentityAccessService } from "./identity-access.service";

@Controller()
export class IdentityAccessController {
  constructor(private readonly service: IdentityAccessService) {}

  @Get("organizations")
  getOrganizations() {
    return this.service.getOrganizations();
  }

  @Get("teams")
  getTeams() {
    return this.service.getTeams();
  }

  @Get("access/users")
  @RequirePermissions("users.manage")
  getUsers() {
    return this.service.getUsers();
  }

  @Get("access/supervisor-scopes")
  @RequirePermissions("users.manage")
  getSupervisorScopes() {
    return this.service.getSupervisorScopes();
  }

  @Get("access/users/:id")
  @RequirePermissions("users.manage")
  getAccessProfile(@Param("id") id: string) {
    return this.service.getAccessProfile(id);
  }

  @Post("access/users")
  @RequirePermissions("users.manage")
  createUser(@Body() input: CreateUserInput) {
    return this.service.createUser(input);
  }

  @Patch("access/users/:id/role")
  @RequirePermissions("roles.manage")
  assignUserRole(@Param("id") id: string, @Body() input: AssignUserRoleInput) {
    return this.service.assignUserRole(id, input);
  }

  @Post("access/supervisor-scopes")
  @RequirePermissions("users.manage")
  assignSupervisorScope(@Body() input: AssignSupervisorScopeInput) {
    return this.service.assignSupervisorScope(input);
  }
}
