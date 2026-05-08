import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UnauthorizedException
} from "@nestjs/common";
import { ZodError } from "zod";
import {
  adminSettingsSchema,
  hasPermission,
  importCsvSchema,
  reminderRuleSchema,
  updateReminderRuleSchema,
  type CreateReminderRuleInput,
  type ImportCsvInput,
  type UpdateAdminSettingsInput,
  type UpdateReminderRuleInput
} from "@capris/shared";
import { type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RequirePermissions } from "../auth/require-permission.decorator";
import { AdminConfigService } from "./admin-config.service";

@Controller("admin-config")
@RequirePermissions("catalogs.manage")
export class AdminConfigController {
  constructor(private readonly service: AdminConfigService) {}

  @Get("bootstrap")
  getBootstrap(@Req() request: AuthenticatedRequest) {
    assertAdmin(request);
    return this.service.getBootstrap();
  }

  @Post("imports")
  runImport(@Body() input: ImportCsvInput, @Req() request: AuthenticatedRequest) {
    assertAdmin(request);
    return this.service.runImport(parseInput(importCsvSchema, input));
  }

  @Post("reminder-rules")
  createReminderRule(@Body() input: CreateReminderRuleInput, @Req() request: AuthenticatedRequest) {
    assertAdmin(request);
    return this.service.createReminderRule(parseInput(reminderRuleSchema, input));
  }

  @Patch("reminder-rules/:id")
  updateReminderRule(
    @Param("id") id: string,
    @Body() input: UpdateReminderRuleInput,
    @Req() request: AuthenticatedRequest
  ) {
    assertAdmin(request);
    return this.service.updateReminderRule(id, parseInput(updateReminderRuleSchema, input));
  }

  @Put("settings")
  updateSettings(@Body() input: UpdateAdminSettingsInput, @Req() request: AuthenticatedRequest) {
    assertAdmin(request);
    return this.service.updateSettings(parseInput(adminSettingsSchema, input));
  }
}

function parseInput<TOutput>(schema: { parse: (input: unknown) => TOutput }, input: unknown): TOutput {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException(error.issues.map((issue) => issue.message).join(" "));
    }
    throw error;
  }
}

function assertAdmin(request: AuthenticatedRequest) {
  if (!request.auth) {
    throw new BadRequestException("Authenticated request context was not found.");
  }

  if (!hasPermission(request.auth.role, "catalogs.manage")) {
    throw new UnauthorizedException("Only admins can manage imports and admin configuration.");
  }
}
