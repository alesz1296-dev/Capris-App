import { z } from "zod";
import type { Client, Locale, Province, User, Zone } from "./domain";
import type { DashboardResponse } from "./dashboard";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD format.");
const identifierSchema = z.string().trim().min(1);

export const REPORT_NAMES = ["summary", "productivity", "tasks", "client_requests"] as const;

export const reportFiltersSchema = z.object({
  userId: identifierSchema.optional(),
  zoneId: identifierSchema.optional(),
  provinceId: identifierSchema.optional(),
  clientId: identifierSchema.optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional()
});

export const createReportSnapshotSchema = z.object({
  reportName: z.enum(REPORT_NAMES),
  locale: z.enum(["en", "es"]).default("en"),
  filters: reportFiltersSchema.default({})
});

export type ReportName = (typeof REPORT_NAMES)[number];
export type ReportFilters = z.infer<typeof reportFiltersSchema>;

export interface ReportExportResponse {
  reportName: ReportName;
  locale: Locale;
  fileName: string;
  rowCount: number;
  csv: string;
}

export interface ReportSnapshot {
  id: string;
  reportName: ReportName;
  locale: Locale;
  fileName: string;
  filters: ReportFilters;
  rowCount: number;
  csv: string;
  generatedAt: string;
  createdAt: string;
}

export interface ReportSnapshotMutationResult {
  item: ReportSnapshot;
  message: string;
}

export interface ReportBootstrap {
  users: User[];
  provinces: Province[];
  zones: Zone[];
  clients: Client[];
  snapshots: ReportSnapshot[];
  availableReports: ReportName[];
  dashboardPreview: DashboardResponse;
}

export type CreateReportSnapshotInput = z.infer<typeof createReportSnapshotSchema>;
