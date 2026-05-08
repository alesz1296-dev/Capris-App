import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ZodError } from "zod";
import {
  createEvidenceSchema,
  requestMediaRetrySchema,
  uploadCapturedEvidenceSchema,
  updateMediaUploadStatusSchema,
  type CreateEvidenceInput,
  type RequestMediaRetryInput,
  type UploadCapturedEvidenceInput,
  type UpdateMediaUploadStatusInput
} from "@capris/shared";
import { RequirePermissions } from "../auth/require-permission.decorator";
import { ActorAccessService } from "../auth/actor-access.service";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { EvidenceService } from "./evidence.service";

@Controller("evidence")
export class EvidenceController {
  constructor(
    private readonly service: EvidenceService,
    private readonly actorAccessService: ActorAccessService
  ) {}

  @Get("bootstrap")
  @RequirePermissions("evidence.view")
  getBootstrap() {
    return this.service.getEvidenceBootstrap();
  }

  @Get()
  @RequirePermissions("evidence.view")
  getEvidence() {
    return this.service.getEvidence();
  }

  @Post()
  @RequirePermissions("evidence.upload")
  createEvidence(@Body() input: CreateEvidenceInput, @Req() request: AuthenticatedRequest) {
    const actor = this.actorAccessService.getActor(request);
    return this.service.createEvidence(
      parseEvidenceInput(createEvidenceSchema, {
        ...input,
        organizationId: actor.organizationId,
        uploaderUserId: actor.sub
      }),
      actor
    );
  }

  @Post("upload")
  @RequirePermissions("evidence.upload")
  uploadCapturedEvidence(@Body() input: UploadCapturedEvidenceInput, @Req() request: AuthenticatedRequest) {
    const actor = this.actorAccessService.getActor(request);
    return this.service.uploadCapturedEvidence(
      parseEvidenceInput(uploadCapturedEvidenceSchema, {
        ...input,
        organizationId: actor.organizationId,
        uploaderUserId: actor.sub
      }),
      actor
    );
  }

  @Patch("media/:id/upload-status")
  @RequirePermissions("evidence.upload")
  updateMediaUploadStatus(@Param("id") id: string, @Body() input: UpdateMediaUploadStatusInput, @Req() request: AuthenticatedRequest) {
    return this.service.updateMediaUploadStatus(
      id,
      parseEvidenceInput(updateMediaUploadStatusSchema, input),
      this.actorAccessService.getActor(request)
    );
  }

  @Post("media/:id/retry")
  @RequirePermissions("evidence.upload")
  requestMediaRetry(@Param("id") id: string, @Body() input: RequestMediaRetryInput, @Req() request: AuthenticatedRequest) {
    return this.service.requestMediaRetry(
      id,
      parseEvidenceInput(requestMediaRetrySchema, input),
      this.actorAccessService.getActor(request)
    );
  }
}

function parseEvidenceInput<TOutput>(schema: { parse: (input: unknown) => TOutput }, input: unknown): TOutput {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException(error.issues.map((issue) => issue.message).join(" "));
    }

    throw error;
  }
}
