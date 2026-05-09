import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ZodError } from "zod";
import {
  createVisitSchema,
  visitCheckInSchema,
  visitCheckOutSchema,
  type CreateVisitInput,
  type VisitCheckInInput,
  type VisitCheckOutInput
} from "@capris/shared";
import { RequirePermissions } from "../auth/require-permission.decorator";
import { ActorAccessService } from "../auth/actor-access.service";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { VisitsService } from "./visits.service";

@Controller("visits")
export class VisitsController {
  constructor(
    private readonly service: VisitsService,
    private readonly actorAccessService: ActorAccessService
  ) {}

  @Get("bootstrap")
  @RequirePermissions("visits.view")
  getBootstrap(@Req() request: AuthenticatedRequest) {
    return this.service.getVisitBootstrap(this.actorAccessService.getActor(request));
  }

  @Get()
  @RequirePermissions("visits.view")
  getVisits(@Req() request: AuthenticatedRequest) {
    return this.service.getVisits(this.actorAccessService.getActor(request));
  }

  @Get(":id")
  @RequirePermissions("visits.view")
  getVisit(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.getVisit(id, this.actorAccessService.getActor(request));
  }

  @Post()
  @RequirePermissions("visits.manage")
  createVisit(@Body() input: CreateVisitInput, @Req() request: AuthenticatedRequest) {
    const actor = this.actorAccessService.getActor(request);
    return this.service.createVisit(
      parseVisitInput(createVisitSchema, {
        ...input,
        organizationId: actor.organizationId,
        assigneeId: actor.role === "field_user" ? actor.sub : input.assigneeId
      }),
      actor
    );
  }

  @Patch(":id/check-in")
  @RequirePermissions("visits.perform")
  checkInVisit(@Param("id") id: string, @Body() input: VisitCheckInInput, @Req() request: AuthenticatedRequest) {
    return this.service.checkInVisit(id, parseVisitInput(visitCheckInSchema, input), this.actorAccessService.getActor(request));
  }

  @Patch(":id/check-out")
  @RequirePermissions("visits.perform")
  checkOutVisit(@Param("id") id: string, @Body() input: VisitCheckOutInput, @Req() request: AuthenticatedRequest) {
    return this.service.checkOutVisit(id, parseVisitInput(visitCheckOutSchema, input), this.actorAccessService.getActor(request));
  }
}

function parseVisitInput<TOutput>(schema: { parse: (input: unknown) => TOutput }, input: unknown): TOutput {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException(error.issues.map((issue) => issue.message).join(" "));
    }

    throw error;
  }
}
