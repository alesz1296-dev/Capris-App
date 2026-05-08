import { Injectable } from "@nestjs/common";
import {
  DEFAULT_COUNTRY,
  DEFAULT_FIELD_WORKFLOW_RULE,
  DEFAULT_TIMEZONE,
  ROLE_DEFINITIONS,
  ROLE_PERMISSIONS,
  t,
  type Locale,
  type Task
} from "@capris/shared";
import { CatalogsService } from "../catalogs/catalogs.service";
import { IdentityAccessService } from "../identity-access/identity-access.service";

@Injectable()
export class FieldOperationsService {
  constructor(
    private readonly catalogsService: CatalogsService,
    private readonly identityAccessService: IdentityAccessService
  ) {}

  private readonly sampleTasks: Task[] = [
    {
      id: "task_001",
      organizationId: "org_capris",
      title: "Install display at POS",
      requesterId: "user_admin",
      assigneeId: "user_field_001",
      scheduledFor: "2026-05-07",
      provinceId: "province_san_jose",
      zoneId: "zone_central",
      pointOfSaleId: "pos_001",
      activityTypeId: "activity_exhibition",
      taskTypeId: "task_visit",
      status: "pending",
      priority: "high",
      difficulty: "standard"
    }
  ];

  async getBootstrap(locale: Locale) {
    return {
      appName: t(locale, "app.name"),
      defaults: {
        country: DEFAULT_COUNTRY,
        timezone: DEFAULT_TIMEZONE,
        locale
      },
      catalogs: await this.catalogsService.getCatalogBootstrap(),
      identityAccess: await this.identityAccessService.getIdentityAccessBootstrap(),
      roleDefinitions: ROLE_DEFINITIONS,
      roles: ROLE_PERMISSIONS,
      workflowDefaults: DEFAULT_FIELD_WORKFLOW_RULE,
      syncStates: ["pending_sync", "sync_failed", "needs_review", "synced"]
    };
  }

  getDashboard() {
    return {
      taskCompletionRate: 0,
      pendingTasks: this.sampleTasks.filter((task) => task.status === "pending").length,
      overdueTasks: 0,
      visitsCompleted: 0,
      routeCoverage: 0,
      evidenceMissing: 1,
      failedSyncs: 0,
      failedEmails: 0,
      clientRequestAgingDays: 0
    };
  }

  exportCsv(name: string, locale: Locale) {
    const headersByReport: Record<string, string[]> = {
      tasks: [
        t(locale, "status.pending"),
        t(locale, "status.in_progress"),
        t(locale, "status.completed")
      ],
      productivity: [
        t(locale, "dashboard.taskCompletion"),
        t(locale, "dashboard.routeCoverage"),
        t(locale, "dashboard.evidenceMissing")
      ]
    };

    const headers = headersByReport[name] ?? ["id", "name", "status"];
    return `${headers.join(",")}\n`;
  }
}
