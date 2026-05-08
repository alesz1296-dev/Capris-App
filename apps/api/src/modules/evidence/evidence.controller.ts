import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
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
import { EvidenceService } from "./evidence.service";

@Controller("evidence")
export class EvidenceController {
  constructor(private readonly service: EvidenceService) {}

  @Get("bootstrap")
  getBootstrap() {
    return this.service.getEvidenceBootstrap();
  }

  @Get()
  getEvidence() {
    return this.service.getEvidence();
  }

  @Post()
  createEvidence(@Body() input: CreateEvidenceInput) {
    return this.service.createEvidence(parseEvidenceInput(createEvidenceSchema, input));
  }

  @Post("upload")
  uploadCapturedEvidence(@Body() input: UploadCapturedEvidenceInput) {
    return this.service.uploadCapturedEvidence(parseEvidenceInput(uploadCapturedEvidenceSchema, input));
  }

  @Patch("media/:id/upload-status")
  updateMediaUploadStatus(@Param("id") id: string, @Body() input: UpdateMediaUploadStatusInput) {
    return this.service.updateMediaUploadStatus(id, parseEvidenceInput(updateMediaUploadStatusSchema, input));
  }

  @Post("media/:id/retry")
  requestMediaRetry(@Param("id") id: string, @Body() input: RequestMediaRetryInput) {
    return this.service.requestMediaRetry(id, parseEvidenceInput(requestMediaRetrySchema, input));
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
