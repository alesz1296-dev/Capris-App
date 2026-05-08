import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ZodError } from "zod";
import {
  prepareConsignationSchema,
  sendConsignationSchema,
  type PrepareConsignationInput,
  type SendConsignationInput
} from "@capris/shared";
import { ConsignationsService } from "./consignations.service";

@Controller("consignations")
export class ConsignationsController {
  constructor(private readonly service: ConsignationsService) {}

  @Get()
  getConsignations() {
    return this.service.getConsignations();
  }

  @Post("prepare")
  prepareConsignation(@Body() input: PrepareConsignationInput) {
    return this.service.prepareConsignation(parseInput(prepareConsignationSchema, input));
  }

  @Patch(":id/send")
  sendConsignation(@Param("id") id: string, @Body() input: SendConsignationInput) {
    return this.service.sendConsignation(id, parseInput(sendConsignationSchema, input));
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
