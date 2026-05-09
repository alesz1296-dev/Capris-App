import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req
} from "@nestjs/common";
import { ZodError } from "zod";
import {
  createExceptionSchema,
  reviewExceptionSchema,
  type CreateExceptionInput,
  type ReviewExceptionInput
} from "@capris/shared";
import { ActorAccessService } from "../auth/actor-access.service";
import { type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RequirePermissions } from "../auth/require-permission.decorator";
import { ExceptionsService } from "./exceptions.service";

@Controller("exceptions")
export class ExceptionsController {
  constructor(
    private readonly service: ExceptionsService,
    private readonly actorAccessService: ActorAccessService
  ) {}

  @Get("bootstrap")
  @RequirePermissions("exceptions.review")
  getBootstrap() {
    return this.service.getExceptionBootstrap();
  }

  @Get()
  @RequirePermissions("exceptions.review")
  getExceptions() {
    return this.service.getExceptions();
  }

  @Post()
  createException(@Body() input: CreateExceptionInput, @Req() request: AuthenticatedRequest) {
    const actor = this.actorAccessService.getActor(request);
    return this.service.createException(
      parseInput(createExceptionSchema, {
        ...input,
        organizationId: actor.organizationId,
        submittedByUserId: actor.sub
      }),
      actor
    );
  }

  @Patch(":id/review")
  @RequirePermissions("exceptions.review")
  reviewException(
    @Param("id") id: string,
    @Body() input: ReviewExceptionInput,
    @Req() request: AuthenticatedRequest
  ) {
    const actor = this.actorAccessService.getActor(request);
    return this.service.reviewException(
      id,
      parseInput(reviewExceptionSchema, {
        ...input,
        reviewedByUserId: actor.sub
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
