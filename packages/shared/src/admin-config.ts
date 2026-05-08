import { z } from "zod";

const identifierSchema = z.string().trim().min(1);

export const reminderRuleSchema = z.object({
  organizationId: identifierSchema,
  name: z.string().trim().min(2).max(120),
  eventType: z.enum(["task_due", "task_overdue", "missing_evidence", "client_request_due", "client_request_overdue"]),
  channel: z.enum(["push", "email"]),
  offsetMinutes: z.number().int().min(0).max(10080),
  active: z.boolean().default(true)
});

export const updateReminderRuleSchema = reminderRuleSchema.partial().extend({
  organizationId: identifierSchema.optional()
});

export const adminSettingsSchema = z.object({
  organizationId: identifierSchema,
  defaultRecipientEmails: z.array(z.string().email()).default([]),
  retentionPhotoDays: z.number().int().min(1).max(3650),
  retentionGpsDays: z.number().int().min(1).max(3650),
  retentionAuditDays: z.number().int().min(1).max(3650)
});

export interface ReminderRule {
  id: string;
  organizationId: string;
  name: string;
  eventType: "task_due" | "task_overdue" | "missing_evidence" | "client_request_due" | "client_request_overdue";
  channel: "push" | "email";
  offsetMinutes: number;
  active: boolean;
}

export interface AdminSettings {
  organizationId: string;
  defaultRecipientEmails: string[];
  retentionPhotoDays: number;
  retentionGpsDays: number;
  retentionAuditDays: number;
}

export interface AdminConfigBootstrap {
  reminderRules: ReminderRule[];
  settings: AdminSettings;
}

export interface AdminConfigMutationResult<TItem> {
  item: TItem;
  message: string;
}

export type CreateReminderRuleInput = z.infer<typeof reminderRuleSchema>;
export type UpdateReminderRuleInput = z.infer<typeof updateReminderRuleSchema>;
export type UpdateAdminSettingsInput = z.infer<typeof adminSettingsSchema>;
