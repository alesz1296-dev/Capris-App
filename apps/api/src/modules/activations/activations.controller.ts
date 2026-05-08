import { BadRequestException, Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ZodError } from "zod";
import { createActivitySchema, type CreateActivityInput } from "@capris/shared";
import { RequirePermissions } from "../auth/require-permission.decorator";
import { ActorAccessService } from "../auth/actor-access.service";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { ActivitiesService } from "./activations.service";

@Controller("activities")
export class ActivitiesController {
  constructor(
    private readonly service: ActivitiesService,
    private readonly actorAccessService: ActorAccessService
  ) {}

  @Get()
  @RequirePermissions("activities.view")
  getActivities() {
    return this.service.getActivities();
  }

  @Post()
  @RequirePermissions("activities.manage")
  createActivity(@Body() input: CreateActivityInput, @Req() request: AuthenticatedRequest) {
    const actor = this.actorAccessService.getActor(request);
    return this.service.createActivity(
      parseInput(createActivitySchema, {
        ...input,
        organizationId: actor.organizationId,
        userId: actor.sub
      }),
      actor
    );
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
