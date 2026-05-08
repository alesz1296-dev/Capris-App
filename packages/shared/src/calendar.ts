import { z } from "zod";
import { CALENDAR_VIEWS, type AgendaEvent, type CalendarEntry, type CalendarView, type Team, type User } from "./domain";

const identifierSchema = z.string().trim().min(1);
const isoTimestampSchema = z.string().datetime({ offset: true });
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD format.");

export const calendarQuerySchema = z.object({
  view: z.enum(CALENDAR_VIEWS),
  date: isoDateSchema
});

export const createAgendaEventSchema = z
  .object({
    organizationId: identifierSchema,
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(1000).optional(),
    startAt: isoTimestampSchema,
    endAt: isoTimestampSchema,
    allDay: z.boolean(),
    scopeType: z.enum(["organization", "team", "user"]),
    scopeReferenceId: identifierSchema.optional(),
    ownerUserId: identifierSchema.optional(),
    teamId: identifierSchema.optional(),
    colorToken: z.string().trim().max(32).optional(),
    createdByUserId: identifierSchema
  })
  .refine((input) => new Date(input.endAt).getTime() >= new Date(input.startAt).getTime(), {
    message: "endAt must be greater than or equal to startAt."
  });

export const updateAgendaEventSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(1000).optional(),
    startAt: isoTimestampSchema.optional(),
    endAt: isoTimestampSchema.optional(),
    allDay: z.boolean().optional(),
    scopeType: z.enum(["organization", "team", "user"]).optional(),
    scopeReferenceId: identifierSchema.optional(),
    ownerUserId: identifierSchema.optional(),
    teamId: identifierSchema.optional(),
    colorToken: z.string().trim().max(32).optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one agenda event field must be provided."
  });

export interface CalendarQueryInput {
  view: CalendarView;
  date: string;
}

export interface CreateAgendaEventInput {
  organizationId: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  scopeType: "organization" | "team" | "user";
  scopeReferenceId?: string;
  ownerUserId?: string;
  teamId?: string;
  colorToken?: string;
  createdByUserId: string;
}

export interface UpdateAgendaEventInput {
  title?: string;
  description?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  scopeType?: "organization" | "team" | "user";
  scopeReferenceId?: string;
  ownerUserId?: string;
  teamId?: string;
  colorToken?: string;
}

export interface AgendaEventMutationResult {
  item: AgendaEvent;
  message: string;
}

export interface CalendarWindow {
  view: CalendarView;
  anchorDate: string;
  startDate: string;
  endDate: string;
}

export interface CalendarBootstrap {
  window: CalendarWindow;
  entries: CalendarEntry[];
  agendaEvents: AgendaEvent[];
  users: User[];
  teams: Team[];
}

export type CalendarQuerySchemaInput = z.infer<typeof calendarQuerySchema>;
export type CreateAgendaEventSchemaInput = z.infer<typeof createAgendaEventSchema>;
export type UpdateAgendaEventSchemaInput = z.infer<typeof updateAgendaEventSchema>;
