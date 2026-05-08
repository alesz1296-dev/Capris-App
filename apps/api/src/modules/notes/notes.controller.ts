import { BadRequestException, Body, Controller, Get, Post } from "@nestjs/common";
import { ZodError } from "zod";
import {
  createCommentSchema,
  createObservationSchema,
  type CreateCommentInput,
  type CreateObservationInput
} from "@capris/shared";
import { NotesService } from "./notes.service";

@Controller("notes")
export class NotesController {
  constructor(private readonly service: NotesService) {}

  @Get("comments")
  getComments() {
    return this.service.getComments();
  }

  @Get("observations")
  getObservations() {
    return this.service.getObservations();
  }

  @Post("comments")
  createComment(@Body() input: CreateCommentInput) {
    return this.service.createComment(parseInput(createCommentSchema, input));
  }

  @Post("observations")
  createObservation(@Body() input: CreateObservationInput) {
    return this.service.createObservation(parseInput(createObservationSchema, input));
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
