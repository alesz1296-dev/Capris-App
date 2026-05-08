import { z } from "zod";

export const IMPORT_ENTITY_TYPES = [
  "users",
  "clients",
  "provinces",
  "zones",
  "points_of_sale",
  "activity_types",
  "task_types"
] as const;

export const importCsvSchema = z.object({
  organizationId: z.string().trim().min(1),
  entityType: z.enum(IMPORT_ENTITY_TYPES),
  csvContent: z.string().min(1, "csvContent is required.")
});

export type ImportEntityType = (typeof IMPORT_ENTITY_TYPES)[number];

export interface ImportFailure {
  rowNumber: number;
  reason: string;
}

export interface ImportResult {
  entityType: ImportEntityType;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  failures: ImportFailure[];
}

export type ImportCsvInput = z.infer<typeof importCsvSchema>;
