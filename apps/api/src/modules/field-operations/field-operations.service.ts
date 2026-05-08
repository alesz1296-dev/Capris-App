import { Injectable } from "@nestjs/common";
import {
  DEFAULT_COUNTRY,
  DEFAULT_FIELD_WORKFLOW_RULE,
  DEFAULT_TIMEZONE,
  ROLE_DEFINITIONS,
  ROLE_PERMISSIONS,
  t,
  type Locale
} from "@capris/shared";
import { CatalogsService } from "../catalogs/catalogs.service";
import { IdentityAccessService } from "../identity-access/identity-access.service";
import { TasksService } from "../tasks/tasks.service";

@Injectable()
export class FieldOperationsService {
  constructor(
    private readonly catalogsService: CatalogsService,
    private readonly identityAccessService: IdentityAccessService,
    private readonly tasksService: TasksService
  ) {}

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

  async getDashboard() {
    const tasks = await this.tasksService.getTasks();

    return {
      taskCompletionRate: 0,
      pendingTasks: tasks.filter((task) => task.status === "pending").length,
      overdueTasks: 0,
      visitsCompleted: 0,
      routeCoverage: 0,
      evidenceMissing: 0,
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
