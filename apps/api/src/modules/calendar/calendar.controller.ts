import { BadRequestException, Body, Controller, Get, Patch, Post, Query, Param, Req } from "@nestjs/common";
import { ZodError } from "zod";
import {
  calendarQuerySchema,
  createAgendaEventSchema,
  updateAgendaEventSchema,
  type CalendarQueryInput,
  type CreateAgendaEventInput,
  type UpdateAgendaEventInput
} from "@capris/shared";
import { RequirePermissions } from "../auth/require-permission.decorator";
import { ActorAccessService } from "../auth/actor-access.service";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { CalendarService } from "./calendar.service";

@Controller("calendar")
export class CalendarController {
  constructor(
    private readonly service: CalendarService,
    private readonly actorAccessService: ActorAccessService
  ) {}

  @Get("bootstrap")
  @RequirePermissions("calendar.view")
  getBootstrap(@Query() query: CalendarQueryInput) {
    return this.service.getCalendarBootstrap(parseInput(calendarQuerySchema, query));
  }

  @Get("agenda-events")
  @RequirePermissions("calendar.view")
  getAgendaEvents() {
    return this.service.getAgendaEvents();
  }

  @Post("agenda-events")
  @RequirePermissions("calendar.manage")
  createAgendaEvent(@Body() input: CreateAgendaEventInput, @Req() request: AuthenticatedRequest) {
    const actor = this.actorAccessService.getActor(request);
    return this.service.createAgendaEvent(
      parseInput(createAgendaEventSchema, {
        ...input,
        organizationId: actor.organizationId,
        createdByUserId: actor.sub
      }),
      actor
    );
  }

  @Patch("agenda-events/:id")
  @RequirePermissions("calendar.manage")
  updateAgendaEvent(@Param("id") id: string, @Body() input: UpdateAgendaEventInput, @Req() request: AuthenticatedRequest) {
    return this.service.updateAgendaEvent(id, parseInput(updateAgendaEventSchema, input), this.actorAccessService.getActor(request));
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
