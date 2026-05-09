import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ZodError } from "zod";
import {
  createClientRequestSchema,
  updateClientRequestSchema,
  updateClientRequestStatusSchema,
  type CreateClientRequestInput,
  type UpdateClientRequestInput,
  type UpdateClientRequestStatusInput
} from "@capris/shared";
import { RequirePermissions } from "../auth/require-permission.decorator";
import { ActorAccessService } from "../auth/actor-access.service";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { ClientRequestsService } from "./client-requests.service";

@Controller("client-requests")
export class ClientRequestsController {
  constructor(
    private readonly service: ClientRequestsService,
    private readonly actorAccessService: ActorAccessService
  ) {}

  @Get("bootstrap")
  @RequirePermissions("client_requests.view")
  getBootstrap(@Req() request: AuthenticatedRequest) {
    return this.service.getClientRequestBootstrap(this.actorAccessService.getActor(request));
  }

  @Get()
  @RequirePermissions("client_requests.view")
  getRequests(@Req() request: AuthenticatedRequest) {
    return this.service.getClientRequests(this.actorAccessService.getActor(request));
  }

  @Post()
  @RequirePermissions("client_requests.manage")
  createClientRequest(@Body() input: CreateClientRequestInput, @Req() request: AuthenticatedRequest) {
    const actor = this.actorAccessService.getActor(request);
    return this.service.createClientRequest(
      parseInput(createClientRequestSchema, {
        ...input,
        organizationId: actor.organizationId,
        ownerUserId: actor.role === "field_user" ? actor.sub : input.ownerUserId
      }),
      actor
    );
  }

  @Patch(":id")
  @RequirePermissions("client_requests.manage")
  updateClientRequest(@Param("id") id: string, @Body() input: UpdateClientRequestInput, @Req() request: AuthenticatedRequest) {
    return this.service.updateClientRequest(id, parseInput(updateClientRequestSchema, input), this.actorAccessService.getActor(request));
  }

  @Patch(":id/status")
  @RequirePermissions("client_requests.manage")
  updateClientRequestStatus(@Param("id") id: string, @Body() input: UpdateClientRequestStatusInput, @Req() request: AuthenticatedRequest) {
    return this.service.updateClientRequestStatus(
      id,
      parseInput(updateClientRequestStatusSchema, input),
      this.actorAccessService.getActor(request)
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
