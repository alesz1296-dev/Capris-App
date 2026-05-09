import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ZodError } from "zod";
import {
  failConsignationSchema,
  prepareConsignationSchema,
  reviewConsignationSchema,
  sendConsignationSchema,
  type FailConsignationInput,
  type PrepareConsignationInput,
  type ReviewConsignationInput,
  type SendConsignationInput
} from "@capris/shared";
import { RequirePermissions } from "../auth/require-permission.decorator";
import { ActorAccessService } from "../auth/actor-access.service";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { ConsignationsService } from "./consignations.service";

@Controller("consignations")
export class ConsignationsController {
  constructor(
    private readonly service: ConsignationsService,
    private readonly actorAccessService: ActorAccessService
  ) {}

  @Get()
  @RequirePermissions("consignations.view")
  getConsignations(@Req() request: AuthenticatedRequest) {
    return this.service.getConsignations(this.actorAccessService.getActor(request));
  }

  @Post("prepare")
  @RequirePermissions("consignations.review_send")
  prepareConsignation(@Body() input: PrepareConsignationInput, @Req() request: AuthenticatedRequest) {
    const actor = this.actorAccessService.getActor(request);
    return this.service.prepareConsignation(
      parseInput(prepareConsignationSchema, {
        ...input,
        organizationId: actor.organizationId
      }),
      actor
    );
  }

  @Patch(":id/review")
  @RequirePermissions("consignations.review_send")
  reviewConsignation(@Param("id") id: string, @Body() input: ReviewConsignationInput, @Req() request: AuthenticatedRequest) {
    return this.service.reviewConsignation(id, parseInput(reviewConsignationSchema, input), this.actorAccessService.getActor(request));
  }

  @Patch(":id/send")
  @RequirePermissions("consignations.review_send")
  sendConsignation(@Param("id") id: string, @Body() input: SendConsignationInput, @Req() request: AuthenticatedRequest) {
    return this.service.sendConsignation(id, parseInput(sendConsignationSchema, input), this.actorAccessService.getActor(request));
  }

  @Patch(":id/fail")
  @RequirePermissions("consignations.review_send")
  failConsignation(@Param("id") id: string, @Body() input: FailConsignationInput, @Req() request: AuthenticatedRequest) {
    return this.service.failConsignation(id, parseInput(failConsignationSchema, input), this.actorAccessService.getActor(request));
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
