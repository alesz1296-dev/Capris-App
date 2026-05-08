import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ZodError } from "zod";
import {
  createVisitSchema,
  visitCheckInSchema,
  visitCheckOutSchema,
  type CreateVisitInput,
  type VisitCheckInInput,
  type VisitCheckOutInput
} from "@capris/shared";
import { VisitsService } from "./visits.service";

@Controller("visits")
export class VisitsController {
  constructor(private readonly service: VisitsService) {}

  @Get("bootstrap")
  getBootstrap() {
    return this.service.getVisitBootstrap();
  }

  @Get()
  getVisits() {
    return this.service.getVisits();
  }

  @Get(":id")
  getVisit(@Param("id") id: string) {
    return this.service.getVisit(id);
  }

  @Post()
  createVisit(@Body() input: CreateVisitInput) {
    return this.service.createVisit(parseVisitInput(createVisitSchema, input));
  }

  @Patch(":id/check-in")
  checkInVisit(@Param("id") id: string, @Body() input: VisitCheckInInput) {
    return this.service.checkInVisit(id, parseVisitInput(visitCheckInSchema, input));
  }

  @Patch(":id/check-out")
  checkOutVisit(@Param("id") id: string, @Body() input: VisitCheckOutInput) {
    return this.service.checkOutVisit(id, parseVisitInput(visitCheckOutSchema, input));
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
