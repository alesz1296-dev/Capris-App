import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException
} from "@nestjs/common";
import { ZodError } from "zod";
import {
  createExceptionSchema,
  hasPermission,
  reviewExceptionSchema,
  type CreateExceptionInput,
  type ReviewExceptionInput
} from "@capris/shared";
import { type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { ExceptionsService } from "./exceptions.service";

@Controller("exceptions")
export class ExceptionsController {
  constructor(private readonly service: ExceptionsService) {}

  @Get("bootstrap")
  getBootstrap() {
    return this.service.getExceptionBootstrap();
  }

  @Get()
  getExceptions() {
    return this.service.getExceptions();
  }

  @Post()
  createException(@Body() input: CreateExceptionInput, @Req() request: AuthenticatedRequest) {
    assertAuthenticatedUser(request);

    if (request.auth?.sub !== input.submittedByUserId) {
      throw new UnauthorizedException("Exception submitter must match the authenticated user.");
    }

    return this.service.createException(parseInput(createExceptionSchema, input));
  }

  @Patch(":id/review")
  reviewException(
    @Param("id") id: string,
    @Body() input: ReviewExceptionInput,
    @Req() request: AuthenticatedRequest
  ) {
    assertAuthenticatedUser(request);

    if (request.auth?.sub !== input.reviewedByUserId) {
      throw new UnauthorizedException("Exception reviewer must match the authenticated user.");
    }

    if (!hasPermission(request.auth.role, "exceptions.review")) {
      throw new UnauthorizedException("Only supervisors or admins can review exceptions.");
    }

    return this.service.reviewException(id, parseInput(reviewExceptionSchema, input));
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

function assertAuthenticatedUser(request: AuthenticatedRequest) {
  if (!request.auth) {
    throw new BadRequestException("Authenticated request context was not found.");
  }
}
