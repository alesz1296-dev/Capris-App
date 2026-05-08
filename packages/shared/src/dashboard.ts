import type { Locale, TaskStatus, VisitStatus } from "./domain";

export type ProductivityDimension = "field_user" | "zone" | "province" | "client";

export interface DashboardSummary {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  pendingTasks: number;
  overdueTasks: number;
  totalVisits: number;
  completedVisits: number;
  routeCoverageRate: number;
  tasksMissingEvidence: number;
  activitiesCount: number;
  exhibitionsCount: number;
  openClientRequests: number;
  overdueClientRequests: number;
  averageClientRequestAgingDays: number;
  failedUploads: number;
  failedEmails: number;
}

export interface ProductivitySummary {
  dimension: ProductivityDimension;
  referenceId: string;
  label: string;
  assignedTasks: number;
  completedTasks: number;
  completionRate: number;
  visitsCompleted: number;
  activitiesCount: number;
  exhibitionsCount: number;
  openClientRequests: number;
  overdueClientRequests: number;
}

export interface DashboardResponse {
  generatedAt: string;
  locale: Locale;
  summary: DashboardSummary;
  productivity: {
    fieldUsers: ProductivitySummary[];
    zones: ProductivitySummary[];
    provinces: ProductivitySummary[];
    clients: ProductivitySummary[];
  };
}

export interface DashboardMetricCard {
  key:
    | "taskCompletion"
    | "pendingTasks"
    | "overdueTasks"
    | "routeCoverage"
    | "evidenceMissing"
    | "activitiesCompleted"
    | "exhibitionsInstalled"
    | "openClientRequests"
    | "overdueClientRequests"
    | "failedUploads"
    | "failedEmails"
    | "averageRequestAging";
  value: number;
}

export interface StatusBreakdownEntry {
  status: TaskStatus | VisitStatus;
  count: number;
}
