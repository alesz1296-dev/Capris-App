import { BadRequestException, Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ZodError } from "zod";
import {
  createCommentSchema,
  createObservationSchema,
  type CreateCommentInput,
  type CreateObservationInput
} from "@capris/shared";
import { RequirePermissions } from "../auth/require-permission.decorator";
import { ActorAccessService } from "../auth/actor-access.service";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { NotesService } from "./notes.service";

@Controller("notes")
export class NotesController {
  constructor(
    private readonly service: NotesService,
    private readonly actorAccessService: ActorAccessService
  ) {}

  @Get("comments")
  @RequirePermissions("notes.view")
  getComments() {
    return this.service.getComments();
  }

  @Get("observations")
  @RequirePermissions("notes.view")
  getObservations() {
    return this.service.getObservations();
  }

  @Post("comments")
  @RequirePermissions("notes.manage")
  createComment(@Body() input: CreateCommentInput, @Req() request: AuthenticatedRequest) {
    const actor = this.actorAccessService.getActor(request);
    return this.service.createComment(
      parseInput(createCommentSchema, {
        ...input,
        organizationId: actor.organizationId,
        userId: actor.sub
      }),
      actor
    );
  }

  @Post("observations")
  @RequirePermissions("notes.manage")
  createObservation(@Body() input: CreateObservationInput, @Req() request: AuthenticatedRequest) {
    const actor = this.actorAccessService.getActor(request);
    return this.service.createObservation(
      parseInput(createObservationSchema, {
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
