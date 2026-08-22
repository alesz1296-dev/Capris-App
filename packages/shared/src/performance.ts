import type { Locale, TaskStatus } from "./domain";
import type { ReportFilters } from "./reporting";

export interface TaskStatusCount {
  status: TaskStatus;
  count: number;
}

export interface FieldUserPerformanceScorecard {
  userId: string;
  userName: string;
  assignedTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  cancelledTasks: number;
  rescheduledTasks: number;
  overdueTasks: number;
  completionRate: number;
  visitsCompleted: number;
  activitiesCount: number;
  exhibitionsCount: number;
  evidenceItems: number;
  openClientRequests: number;
  overdueClientRequests: number;
}

export interface PerformanceDashboardResponse {
  generatedAt: string;
  locale: Locale;
  filters: ReportFilters;
  summary: {
    assignedTasks: number;
    completedTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    cancelledTasks: number;
    rescheduledTasks: number;
    overdueTasks: number;
    completionRate: number;
    visitsCompleted: number;
    evidenceItems: number;
    activitiesCount: number;
    exhibitionsCount: number;
  };
  statusBreakdown: TaskStatusCount[];
  scorecards: FieldUserPerformanceScorecard[];
}

