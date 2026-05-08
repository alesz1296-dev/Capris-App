import { BadRequestException, Injectable } from "@nestjs/common";
import {
  CLIENT_REQUEST_STATUSES,
  DEFAULT_COUNTRY,
  DEFAULT_FIELD_WORKFLOW_RULE,
  DEFAULT_TIMEZONE,
  REPORT_NAMES,
  ROLE_DEFINITIONS,
  ROLE_PERMISSIONS,
  t,
  type ClientRequestStatus,
  type DashboardResponse,
  type ProductivityDimension,
  type ProductivitySummary,
  type CreateReportSnapshotInput,
  type Locale,
  type ReportBootstrap,
  type ReportExportResponse,
  type ReportFilters,
  type ReportName,
  type ReportSnapshot,
  type Task,
  type Visit
} from "@capris/shared";
import { CatalogsService } from "../catalogs/catalogs.service";
import { PrismaService } from "../database/prisma.service";
import { IdentityAccessService } from "../identity-access/identity-access.service";
import { TasksService } from "../tasks/tasks.service";

type DashboardPrisma = PrismaService & {
  visit: any;
  evidencePhoto: any;
  mediaAsset: any;
  activation: any;
  exhibitionInstallation: any;
  consignation: any;
  clientRequest: any;
  reportSnapshot: any;
};

@Injectable()
export class FieldOperationsService {
  constructor(
    private readonly prisma: PrismaService,
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

  async getDashboard(locale: Locale): Promise<DashboardResponse> {
    const prisma = this.prisma as unknown as DashboardPrisma;
    const [tasks, visits, evidencePhotos, mediaAssets, activities, exhibitions, consignations, requests, users, catalogs] = await Promise.all([
      this.tasksService.getTasks(),
      prisma.visit.findMany({ orderBy: [{ scheduledFor: "asc" }] }),
      prisma.evidencePhoto.findMany({ orderBy: [{ capturedAt: "desc" }] }),
      prisma.mediaAsset.findMany({ orderBy: [{ capturedAt: "desc" }] }),
      prisma.activation.findMany({ orderBy: [{ recordedAt: "desc" }] }),
      prisma.exhibitionInstallation.findMany({ orderBy: [{ recordedAt: "desc" }] }),
      prisma.consignation.findMany({ orderBy: [{ preparedAt: "desc" }] }),
      prisma.clientRequest.findMany({ orderBy: [{ dueDate: "asc" }] }),
      this.identityAccessService.getUsers(),
      this.catalogsService.getCatalogBootstrap()
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const completedTasks = tasks.filter((task) => task.status === "completed");
    const pendingTasks = tasks.filter((task) => task.status === "pending");
    const overdueTasks = tasks.filter((task) => task.status !== "completed" && task.scheduledFor < today);
    const completedVisits = visits.filter((visit: any) => visit.status === "checked_out");
    const routeCoverageRate = visits.length ? this.toPercent(completedVisits.length / visits.length) : 0;

    const mediaStatusById = new Map<string, { uploadStatus: string; syncState?: string }>(
      mediaAssets.map((mediaAsset: any) => [mediaAsset.id, { uploadStatus: mediaAsset.uploadStatus, syncState: mediaAsset.syncState }])
    );
    const evidenceByTask = new Map<string, Array<{ type: string; uploaded: boolean }>>();
    for (const item of evidencePhotos) {
      const uploadStatus = mediaStatusById.get(item.mediaAssetId)?.uploadStatus ?? "pending_upload";
      const current = evidenceByTask.get(item.taskId) ?? [];
      current.push({ type: item.type, uploaded: uploadStatus === "uploaded" });
      evidenceByTask.set(item.taskId, current);
    }

    const missingEvidenceTasks = tasks.filter((task) => {
      const rule = catalogs.workflowRules
        .filter((candidate) => candidate.organizationId === task.organizationId)
        .filter(
          (candidate) =>
            (candidate.taskTypeId === undefined || candidate.taskTypeId === task.taskTypeId) &&
            (candidate.activityTypeId === undefined || candidate.activityTypeId === task.activityTypeId)
        )
        .sort((left, right) => {
          const leftScore = Number(left.taskTypeId === task.taskTypeId) + Number(left.activityTypeId === task.activityTypeId);
          const rightScore = Number(right.taskTypeId === task.taskTypeId) + Number(right.activityTypeId === task.activityTypeId);
          return rightScore - leftScore;
        })[0];

      const taskEvidence = evidenceByTask.get(task.id) ?? [];
      const beforeUploaded = taskEvidence.some((item) => item.type === "before" && item.uploaded);
      const afterUploaded = taskEvidence.some((item) => item.type === "after" && item.uploaded);
      return Boolean((rule?.requiresBeforePhoto && !beforeUploaded) || (rule?.requiresAfterPhoto && !afterUploaded));
    }).length;

    const activityCount = activities.reduce((total: number, item: any) => total + item.quantity, 0);
    const exhibitionsCount = exhibitions.reduce((total: number, item: any) => total + item.quantity, 0);
    const openRequests = requests.filter((request: any) => !["resolved", "closed"].includes(request.status));
    const overdueRequests = openRequests.filter((request: any) => request.dueDate < today);
    const averageClientRequestAgingDays = requests.length
      ? Number(
          (
            requests.reduce((total: number, request: any) => total + this.daysBetween(request.openedAt.slice(0, 10), today), 0) /
            requests.length
          ).toFixed(1)
        )
      : 0;

    const failedUploads = mediaAssets.filter((mediaAsset: any) => mediaAsset.uploadStatus === "failed" || mediaAsset.syncState === "sync_failed").length;
    const failedEmails = consignations.filter((item: any) => item.status === "failed").length;

    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const userLabelById = new Map(users.map(({ permissions, ...user }) => [user.id, user.name]));
    const zoneLabelById = new Map(catalogs.zones.map((zone) => [zone.id, zone.name]));
    const provinceLabelById = new Map(catalogs.provinces.map((province) => [province.id, province.name]));
    const clientLabelById = new Map(catalogs.clients.map((client) => [client.id, client.name]));

    return {
      generatedAt: new Date().toISOString(),
      locale,
      summary: {
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        completionRate: tasks.length ? this.toPercent(completedTasks.length / tasks.length) : 0,
        pendingTasks: pendingTasks.length,
        overdueTasks: overdueTasks.length,
        totalVisits: visits.length,
        completedVisits: completedVisits.length,
        routeCoverageRate,
        tasksMissingEvidence: missingEvidenceTasks,
        activitiesCount: activityCount,
        exhibitionsCount,
        openClientRequests: openRequests.length,
        overdueClientRequests: overdueRequests.length,
        averageClientRequestAgingDays,
        failedUploads,
        failedEmails
      },
      productivity: {
        fieldUsers: this.buildProductivity("field_user", tasks, visits, activities, exhibitions, requests, taskById, userLabelById),
        zones: this.buildProductivity("zone", tasks, visits, activities, exhibitions, requests, taskById, zoneLabelById),
        provinces: this.buildProductivity("province", tasks, visits, activities, exhibitions, requests, taskById, provinceLabelById),
        clients: this.buildProductivity("client", tasks, visits, activities, exhibitions, requests, taskById, clientLabelById)
      }
    };
  }

  async getReportBootstrap(locale: Locale): Promise<ReportBootstrap> {
    const [users, catalogs, snapshots, dashboardPreview] = await Promise.all([
      this.identityAccessService.getUsers(),
      this.catalogsService.getCatalogBootstrap(),
      this.getReportSnapshots(),
      this.getDashboard(locale)
    ]);

    return {
      users: users.map(({ permissions, ...user }) => user),
      provinces: catalogs.provinces,
      zones: catalogs.zones,
      clients: catalogs.clients,
      snapshots,
      availableReports: [...REPORT_NAMES],
      dashboardPreview
    };
  }

  async getReportSnapshots(): Promise<ReportSnapshot[]> {
    const snapshots = await (this.prisma as unknown as DashboardPrisma).reportSnapshot.findMany({
      orderBy: [{ createdAt: "desc" }]
    });

    return snapshots.map((snapshot: any) => this.toReportSnapshot(snapshot));
  }

  async createReportSnapshot(input: CreateReportSnapshotInput) {
    const exportResult = await this.exportCsv(input.reportName, input.locale, input.filters);
    const created = await (this.prisma as unknown as DashboardPrisma).reportSnapshot.create({
      data: {
        id: this.createId("snapshot"),
        organizationId: "org_capris",
        reportName: input.reportName,
        locale: input.locale,
        fileName: exportResult.fileName,
        filtersJson: JSON.stringify(input.filters),
        rowCount: exportResult.rowCount,
        csvContent: exportResult.csv,
        generatedAt: new Date().toISOString()
      }
    });

    return {
      item: this.toReportSnapshot(created),
      message: `Report snapshot ${created.id} created.`
    };
  }

  async exportCsv(name: string, locale: Locale, filters: ReportFilters = {}): Promise<ReportExportResponse> {
    if (!REPORT_NAMES.includes(name as ReportName)) {
      throw new BadRequestException(`Unsupported report export ${name}.`);
    }

    const context = await this.getReportingContext(filters);
    const { headers, rows } = this.buildReportRows(name as ReportName, locale, context);
    const csv = [headers, ...rows].map((row) => row.map((value: string) => this.escapeCsv(value)).join(",")).join("\n");

    return {
      reportName: name as ReportName,
      locale,
      fileName: `capris-${name}-${new Date().toISOString().slice(0, 10)}.csv`,
      rowCount: rows.length,
      csv
    };
  }

  private buildProductivity(
    dimension: ProductivityDimension,
    tasks: Awaited<ReturnType<TasksService["getTasks"]>>,
    visits: any[],
    activities: any[],
    exhibitions: any[],
    requests: any[],
    taskById: Map<string, Awaited<ReturnType<TasksService["getTasks"]>>[number]>,
    labelById: Map<string, string>
  ): ProductivitySummary[] {
    const buckets = new Map<string, ProductivitySummary>();
    const ensureBucket = (referenceId: string | undefined, fallbackLabel: string) => {
      if (!referenceId) {
        return null;
      }
      const existing = buckets.get(referenceId);
      if (existing) {
        return existing;
      }
      const created: ProductivitySummary = {
        dimension,
        referenceId,
        label: labelById.get(referenceId) ?? fallbackLabel,
        assignedTasks: 0,
        completedTasks: 0,
        completionRate: 0,
        visitsCompleted: 0,
        activitiesCount: 0,
        exhibitionsCount: 0,
        openClientRequests: 0,
        overdueClientRequests: 0
      };
      buckets.set(referenceId, created);
      return created;
    };

    const today = new Date().toISOString().slice(0, 10);
    const requestStatusClosed = new Set<(typeof CLIENT_REQUEST_STATUSES)[number]>(["resolved", "closed"]);

    for (const task of tasks) {
      const referenceId =
        dimension === "field_user" ? task.assigneeId :
        dimension === "zone" ? task.zoneId :
        dimension === "province" ? task.provinceId :
        task.clientId;
      const bucket = ensureBucket(referenceId, referenceId ?? "Unknown");
      if (!bucket) {
        continue;
      }
      bucket.assignedTasks += 1;
      if (task.status === "completed") {
        bucket.completedTasks += 1;
      }
    }

    for (const visit of visits) {
      const task = taskById.get(visit.taskId);
      const referenceId =
        dimension === "field_user" ? visit.assigneeId :
        dimension === "zone" ? visit.zoneId :
        dimension === "province" ? visit.provinceId :
        task?.clientId;
      const bucket = ensureBucket(referenceId, referenceId ?? "Unknown");
      if (!bucket) {
        continue;
      }
      if (visit.status === "checked_out") {
        bucket.visitsCompleted += 1;
      }
    }

    for (const activity of activities) {
      const task = taskById.get(activity.taskId);
      const referenceId =
        dimension === "field_user" ? activity.userId :
        dimension === "zone" ? task?.zoneId :
        dimension === "province" ? task?.provinceId :
        task?.clientId;
      const bucket = ensureBucket(referenceId, referenceId ?? "Unknown");
      if (!bucket) {
        continue;
      }
      bucket.activitiesCount += activity.quantity;
    }

    for (const exhibition of exhibitions) {
      const task = taskById.get(exhibition.taskId);
      const referenceId =
        dimension === "field_user" ? exhibition.userId :
        dimension === "zone" ? task?.zoneId :
        dimension === "province" ? task?.provinceId :
        task?.clientId;
      const bucket = ensureBucket(referenceId, referenceId ?? "Unknown");
      if (!bucket) {
        continue;
      }
      bucket.exhibitionsCount += exhibition.quantity;
    }

    for (const request of requests) {
      const referenceId =
        dimension === "field_user" ? request.ownerUserId :
        dimension === "zone" ? request.zoneId :
        dimension === "province" ? request.provinceId :
        request.clientId;
      const bucket = ensureBucket(referenceId, referenceId ?? "Unknown");
      if (!bucket) {
        continue;
      }
      if (!requestStatusClosed.has(request.status)) {
        bucket.openClientRequests += 1;
        if (request.dueDate < today) {
          bucket.overdueClientRequests += 1;
        }
      }
    }

    return [...buckets.values()]
      .map((bucket) => ({
        ...bucket,
        completionRate: bucket.assignedTasks ? this.toPercent(bucket.completedTasks / bucket.assignedTasks) : 0
      }))
      .sort((left, right) => {
        if (right.completedTasks !== left.completedTasks) {
          return right.completedTasks - left.completedTasks;
        }
        return right.activitiesCount - left.activitiesCount;
      });
  }

  private toPercent(value: number) {
    return Number((value * 100).toFixed(1));
  }

  private daysBetween(startDate: string, endDate: string) {
    const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
    const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
    return Math.max(0, Math.floor((end - start) / 86400000));
  }

  private async getReportingContext(filters: ReportFilters) {
    const prisma = this.prisma as unknown as DashboardPrisma;
    const [tasks, visits, evidencePhotos, mediaAssets, activities, exhibitions, requests, users, catalogs] = await Promise.all([
      this.tasksService.getTasks(),
      prisma.visit.findMany({ orderBy: [{ scheduledFor: "asc" }] }),
      prisma.evidencePhoto.findMany({ orderBy: [{ capturedAt: "desc" }] }),
      prisma.mediaAsset.findMany({ orderBy: [{ capturedAt: "desc" }] }),
      prisma.activation.findMany({ orderBy: [{ recordedAt: "desc" }] }),
      prisma.exhibitionInstallation.findMany({ orderBy: [{ recordedAt: "desc" }] }),
      prisma.clientRequest.findMany({ orderBy: [{ dueDate: "asc" }] }),
      this.identityAccessService.getUsers(),
      this.catalogsService.getCatalogBootstrap()
    ]);

    const taskMatches = (task: Task) =>
      (!filters.userId || task.assigneeId === filters.userId) &&
      (!filters.zoneId || task.zoneId === filters.zoneId) &&
      (!filters.provinceId || task.provinceId === filters.provinceId) &&
      (!filters.clientId || task.clientId === filters.clientId) &&
      this.matchesDateRange(task.scheduledFor, filters);

    const filteredTasks = tasks.filter(taskMatches);
    const taskIds = new Set(filteredTasks.map((task) => task.id));
    const filteredVisits = visits.filter(
      (visit: any) =>
        taskIds.has(visit.taskId) &&
        (!filters.userId || visit.assigneeId === filters.userId) &&
        (!filters.zoneId || visit.zoneId === filters.zoneId) &&
        (!filters.provinceId || visit.provinceId === filters.provinceId) &&
        this.matchesDateRange(visit.scheduledFor, filters)
    );
    const visitIds = new Set(filteredVisits.map((visit: any) => visit.id));
    const filteredEvidence = evidencePhotos.filter((item: any) => taskIds.has(item.taskId) && (!item.visitId || visitIds.has(item.visitId)));
    const mediaIds = new Set(filteredEvidence.map((item: any) => item.mediaAssetId));
    const filteredMediaAssets = mediaAssets.filter((item: any) => mediaIds.has(item.id));
    const filteredActivities = activities.filter((item: any) => taskIds.has(item.taskId) && this.matchesIsoDateRange(item.recordedAt, filters));
    const filteredExhibitions = exhibitions.filter((item: any) => taskIds.has(item.taskId) && this.matchesIsoDateRange(item.recordedAt, filters));
    const filteredRequests = requests.filter(
      (item: any) =>
        (!filters.userId || item.ownerUserId === filters.userId) &&
        (!filters.zoneId || item.zoneId === filters.zoneId) &&
        (!filters.provinceId || item.provinceId === filters.provinceId) &&
        (!filters.clientId || item.clientId === filters.clientId) &&
        this.matchesDateRange(item.dueDate, filters)
    );

    return {
      tasks: filteredTasks,
      visits: filteredVisits,
      evidencePhotos: filteredEvidence,
      mediaAssets: filteredMediaAssets,
      activities: filteredActivities,
      exhibitions: filteredExhibitions,
      requests: filteredRequests,
      users: users.map(({ permissions, ...user }) => user),
      catalogs
    };
  }

  private buildReportRows(
    name: ReportName,
    locale: Locale,
    context: Awaited<ReturnType<FieldOperationsService["getReportingContext"]>>
  ) {
    const today = new Date().toISOString().slice(0, 10);
    const userLabelById = new Map(context.users.map((user) => [user.id, user.name]));
    const zoneLabelById = new Map(context.catalogs.zones.map((zone) => [zone.id, zone.name]));
    const provinceLabelById = new Map(context.catalogs.provinces.map((province) => [province.id, province.name]));
    const clientLabelById = new Map(context.catalogs.clients.map((client) => [client.id, client.name]));
    const taskById = new Map(context.tasks.map((task) => [task.id, task]));
    const mediaStatusById = new Map<string, { uploadStatus: string; syncState?: string }>(
      context.mediaAssets.map((mediaAsset: any) => [mediaAsset.id, { uploadStatus: mediaAsset.uploadStatus, syncState: mediaAsset.syncState }])
    );
    const evidenceByTask = new Map<string, Array<{ type: string; uploaded: boolean }>>();
    for (const item of context.evidencePhotos) {
      const uploadStatus = mediaStatusById.get(item.mediaAssetId)?.uploadStatus ?? "pending_upload";
      const current = evidenceByTask.get(item.taskId) ?? [];
      current.push({ type: item.type, uploaded: uploadStatus === "uploaded" });
      evidenceByTask.set(item.taskId, current);
    }

    if (name === "summary") {
      const completedTasks = context.tasks.filter((task) => task.status === "completed").length;
      const pendingTasks = context.tasks.filter((task) => task.status === "pending").length;
      const overdueTasks = context.tasks.filter((task) => task.status !== "completed" && task.scheduledFor < today).length;
      const completedVisits = context.visits.filter((visit: any) => visit.status === "checked_out").length;
      const routeCoverageRate = context.visits.length ? this.toPercent(completedVisits / context.visits.length) : 0;
      const missingEvidence = context.tasks.filter((task) => {
        const rule = context.catalogs.workflowRules
          .filter((candidate) => candidate.organizationId === task.organizationId)
          .filter(
            (candidate) =>
              (candidate.taskTypeId === undefined || candidate.taskTypeId === task.taskTypeId) &&
              (candidate.activityTypeId === undefined || candidate.activityTypeId === task.activityTypeId)
          )[0];
        const taskEvidence = evidenceByTask.get(task.id) ?? [];
        const beforeUploaded = taskEvidence.some((item) => item.type === "before" && item.uploaded);
        const afterUploaded = taskEvidence.some((item) => item.type === "after" && item.uploaded);
        return Boolean((rule?.requiresBeforePhoto && !beforeUploaded) || (rule?.requiresAfterPhoto && !afterUploaded));
      }).length;
      const activitiesCount = context.activities.reduce((total: number, item: any) => total + item.quantity, 0);
      const exhibitionsCount = context.exhibitions.reduce((total: number, item: any) => total + item.quantity, 0);
      const openRequests = context.requests.filter((request: any) => !["resolved", "closed"].includes(request.status)).length;
      const overdueClientRequests = context.requests.filter(
        (request: any) => !["resolved", "closed"].includes(request.status) && request.dueDate < today
      ).length;

      return {
        headers: [
          t(locale, "reports.column.generatedAt"),
          t(locale, "reports.column.completedTasks"),
          t(locale, "reports.column.pendingTasks"),
          t(locale, "reports.column.overdueTasks"),
          t(locale, "reports.column.routeCoverageRate"),
          t(locale, "reports.column.missingEvidence"),
          t(locale, "reports.column.activitiesCount"),
          t(locale, "reports.column.exhibitionsCount"),
          t(locale, "reports.column.openClientRequests"),
          t(locale, "reports.column.overdueClientRequests")
        ],
        rows: [[
          new Date().toISOString(),
          String(completedTasks),
          String(pendingTasks),
          String(overdueTasks),
          String(routeCoverageRate),
          String(missingEvidence),
          String(activitiesCount),
          String(exhibitionsCount),
          String(openRequests),
          String(overdueClientRequests)
        ]]
      };
    }

    if (name === "productivity") {
      const productivity = [
        ...this.buildProductivity("field_user", context.tasks, context.visits, context.activities, context.exhibitions, context.requests, taskById, userLabelById),
        ...this.buildProductivity("zone", context.tasks, context.visits, context.activities, context.exhibitions, context.requests, taskById, zoneLabelById),
        ...this.buildProductivity("province", context.tasks, context.visits, context.activities, context.exhibitions, context.requests, taskById, provinceLabelById),
        ...this.buildProductivity("client", context.tasks, context.visits, context.activities, context.exhibitions, context.requests, taskById, clientLabelById)
      ];

      return {
        headers: [
          t(locale, "reports.column.dimension"),
          t(locale, "reports.column.label"),
          t(locale, "reports.column.assignedTasks"),
          t(locale, "reports.column.completedTasks"),
          t(locale, "reports.column.completedVisits"),
          t(locale, "reports.column.activitiesCount"),
          t(locale, "reports.column.exhibitionsCount"),
          t(locale, "reports.column.requestsOverdue")
        ],
        rows: productivity.map((row) => [
          row.dimension,
          row.label,
          String(row.assignedTasks),
          String(row.completedTasks),
          String(row.visitsCompleted),
          String(row.activitiesCount),
          String(row.exhibitionsCount),
          `${row.overdueClientRequests}/${row.openClientRequests}`
        ])
      };
    }

    if (name === "client_requests") {
      return {
        headers: [
          t(locale, "reports.column.requestTitle"),
          t(locale, "reports.column.requester"),
          t(locale, "reports.column.owner"),
          t(locale, "reports.column.status"),
          t(locale, "reports.column.dueDate"),
          t(locale, "reports.column.agingDays"),
          t(locale, "reports.column.overdue")
        ],
        rows: context.requests.map((request: any) => [
          request.title,
          request.requesterName,
          userLabelById.get(request.ownerUserId) ?? request.ownerUserId,
          request.status,
          request.dueDate,
          String(this.daysBetween(request.openedAt.slice(0, 10), today)),
          request.dueDate < today && !["resolved", "closed"].includes(request.status as ClientRequestStatus) ? "true" : "false"
        ])
      };
    }

    return {
      headers: [
        t(locale, "reports.column.taskTitle"),
        t(locale, "reports.column.scheduledFor"),
        t(locale, "reports.column.status"),
        t(locale, "reports.column.priority"),
        t(locale, "reports.column.difficulty"),
        t(locale, "reports.user"),
        t(locale, "reports.zone"),
        t(locale, "reports.province"),
        t(locale, "reports.client")
      ],
      rows: context.tasks.map((task) => [
        task.title,
        task.scheduledFor,
        task.status,
        task.priority,
        task.difficulty,
        userLabelById.get(task.assigneeId) ?? task.assigneeId,
        zoneLabelById.get(task.zoneId) ?? task.zoneId,
        provinceLabelById.get(task.provinceId) ?? task.provinceId,
        task.clientId ? clientLabelById.get(task.clientId) ?? task.clientId : ""
      ])
    };
  }

  private toReportSnapshot(snapshot: {
    id: string;
    reportName: string;
    locale: string;
    fileName: string;
    filtersJson: string;
    rowCount: number;
    csvContent: string;
    generatedAt: string;
    createdAt: Date;
  }): ReportSnapshot {
    return {
      id: snapshot.id,
      reportName: snapshot.reportName as ReportName,
      locale: snapshot.locale as Locale,
      fileName: snapshot.fileName,
      filters: JSON.parse(snapshot.filtersJson) as ReportFilters,
      rowCount: snapshot.rowCount,
      csv: snapshot.csvContent,
      generatedAt: snapshot.generatedAt,
      createdAt: snapshot.createdAt.toISOString()
    };
  }

  private matchesDateRange(date: string, filters: ReportFilters) {
    if (filters.dateFrom && date < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && date > filters.dateTo) {
      return false;
    }
    return true;
  }

  private matchesIsoDateRange(dateTime: string, filters: ReportFilters) {
    return this.matchesDateRange(dateTime.slice(0, 10), filters);
  }

  private escapeCsv(value: string) {
    const normalized = value ?? "";
    if (/[",\n]/.test(normalized)) {
      return `"${normalized.replaceAll("\"", "\"\"")}"`;
    }
    return normalized;
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
