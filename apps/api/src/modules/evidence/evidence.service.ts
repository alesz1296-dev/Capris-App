import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  Activity,
  Comment,
  Consignation,
  CreateEvidenceInput,
  EvidenceBootstrap,
  EvidenceMutationResult,
  EvidencePhoto,
  EvidenceRequirementSummary,
  ExhibitionInstallation,
  MediaAsset,
  MediaAssetMutationResult,
  RequestMediaRetryInput,
  SyncOperation,
  Task,
  Observation,
  UploadCapturedEvidenceInput,
  UpdateMediaUploadStatusInput,
  UploadStatus,
  User,
  Visit,
  WorkflowRule
} from "@capris/shared";
import { CatalogsService } from "../catalogs/catalogs.service";
import { ActorAccessService } from "../auth/actor-access.service";
import type { AuthJwtPayload } from "../auth/auth-token.service";
import { PrismaService } from "../database/prisma.service";
import { IdentityAccessService } from "../identity-access/identity-access.service";
import { ObjectStorageService } from "../object-storage/object-storage.service";

type EvidencePrisma = PrismaService & {
  comment: any;
  observation: any;
  consignation: any;
  activation: any;
  exhibitionInstallation: any;
  evidencePhoto: any;
  mediaAsset: any;
  task: any;
  visit: any;
  user: any;
  $transaction: any;
};

const ALLOWED_UPLOAD_TRANSITIONS: Record<UploadStatus, UploadStatus[]> = {
  pending_upload: ["uploading", "uploaded", "failed"],
  uploading: ["uploaded", "failed"],
  uploaded: [],
  failed: ["pending_upload", "uploading", "uploaded"]
};

const DEFAULT_CHUNK_COUNT = 4;

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogsService: CatalogsService,
    private readonly identityAccessService: IdentityAccessService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly actorAccessService: ActorAccessService
  ) {}

  async getEvidenceBootstrap(): Promise<EvidenceBootstrap> {
    const [activities, evidence, exhibitions, mediaAssets, comments, observations, consignations, tasks, visits, users, catalogs] = await Promise.all([
      this.getActivities(),
      this.getEvidence(),
      this.getExhibitions(),
      this.getMediaAssets(),
      this.getComments(),
      this.getObservations(),
      this.getConsignations(),
      this.getTasks(),
      this.getVisits(),
      this.identityAccessService.getUsers(),
      this.catalogsService.getCatalogBootstrap()
    ]);

    return {
      activities,
      clients: catalogs.clients,
      evidence,
      exhibitions,
      mediaAssets,
      comments,
      observations,
      consignations,
      pointsOfSale: catalogs.pointsOfSale,
      tasks,
      visits,
      users: users.map(({ permissions, ...user }) => user),
      workflowRules: catalogs.workflowRules,
      requirementSummaries: await this.getRequirementSummaries(tasks, evidence, mediaAssets, catalogs.workflowRules),
      pendingSyncOperations: this.buildPendingSyncOperations(mediaAssets)
    };
  }

  async getEvidence(): Promise<EvidencePhoto[]> {
    const prisma = this.prisma as unknown as EvidencePrisma;
    const evidence = await prisma.evidencePhoto.findMany({
      include: {
        mediaAsset: true
      },
      orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }]
    });

    return evidence.map((item: any) => this.toEvidence(item));
  }

  async getMediaAssets(): Promise<MediaAsset[]> {
    const prisma = this.prisma as unknown as EvidencePrisma;
    const mediaAssets = await prisma.mediaAsset.findMany({
      orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }]
    });

    return mediaAssets.map((mediaAsset: any) => this.toMediaAsset(mediaAsset));
  }

  async getComments(): Promise<Comment[]> {
    const prisma = this.prisma as unknown as EvidencePrisma;
    const items = await prisma.comment.findMany({
      orderBy: [{ createdAt: "desc" }]
    });
    return items.map((item: any) => ({
      id: item.id,
      organizationId: item.organizationId,
      taskId: item.taskId,
      userId: item.userId,
      body: item.body,
      createdAt: item.createdAt
    }));
  }

  async getObservations(): Promise<Observation[]> {
    const prisma = this.prisma as unknown as EvidencePrisma;
    const items = await prisma.observation.findMany({
      orderBy: [{ createdAt: "desc" }]
    });
    return items.map((item: any) => ({
      id: item.id,
      organizationId: item.organizationId,
      taskId: item.taskId,
      userId: item.userId,
      body: item.body,
      createdAt: item.createdAt
    }));
  }

  async getConsignations(): Promise<Consignation[]> {
    const prisma = this.prisma as unknown as EvidencePrisma;
    const items = await prisma.consignation.findMany({
      orderBy: [{ preparedAt: "desc" }, { createdAt: "desc" }]
    });
    return items.map((item: any) => ({
      id: item.id,
      organizationId: item.organizationId,
      taskId: item.taskId,
      userId: item.userId,
      visitId: item.visitId ?? undefined,
      note: item.note ?? undefined,
      status: item.status,
      preparedAt: item.preparedAt,
      reviewedAt: item.reviewedAt ?? undefined,
      recipientEmails: item.recipientEmails ? item.recipientEmails.split(",").map((email: string) => email.trim()).filter(Boolean) : [],
      emailSubject: item.emailSubject ?? undefined,
      emailBody: item.emailBody ?? undefined,
      beforeEvidenceId: item.beforeEvidenceId ?? undefined,
      afterEvidenceId: item.afterEvidenceId ?? undefined,
      sendFailureReason: item.sendFailureReason ?? undefined,
      failedAt: item.failedAt ?? undefined,
      sentAt: item.sentAt ?? undefined
    }));
  }

  async getActivities(): Promise<Activity[]> {
    const prisma = this.prisma as unknown as EvidencePrisma;
    const items = await prisma.activation.findMany({
      orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }]
    });

    return items.map((item: any) => ({
      id: item.id,
      organizationId: item.organizationId,
      taskId: item.taskId,
      userId: item.userId,
      visitId: item.visitId ?? undefined,
      pointOfSaleId: item.pointOfSaleId ?? undefined,
      quantity: item.quantity,
      note: item.note ?? undefined,
      recordedAt: item.recordedAt
    }));
  }

  async getExhibitions(): Promise<ExhibitionInstallation[]> {
    const prisma = this.prisma as unknown as EvidencePrisma;
    const items = await prisma.exhibitionInstallation.findMany({
      orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }]
    });

    return items.map((item: any) => ({
      id: item.id,
      organizationId: item.organizationId,
      taskId: item.taskId,
      userId: item.userId,
      visitId: item.visitId ?? undefined,
      pointOfSaleId: item.pointOfSaleId ?? undefined,
      quantity: item.quantity,
      note: item.note ?? undefined,
      recordedAt: item.recordedAt
    }));
  }

  async createEvidence(input: CreateEvidenceInput, actor?: AuthJwtPayload): Promise<EvidenceMutationResult> {
    const references = await this.assertEvidenceReferences(input);
    if (actor) {
      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: input.organizationId,
        userId: input.uploaderUserId,
        assigneeId: references.task.assigneeId,
        provinceId: references.task.provinceId,
        zoneId: references.task.zoneId,
        clientId: references.task.clientId ?? undefined
      });
    }

    const uploadStatus = input.uploadStatus ?? "pending_upload";
    const syncState = input.syncState ?? this.deriveSyncState(uploadStatus);
    const uploadProgress = input.uploadProgress ?? this.deriveUploadProgress(uploadStatus);
    const retryCount = input.retryCount ?? 0;
    const chunkCount = input.chunkCount ?? DEFAULT_CHUNK_COUNT;
    const uploadedChunkCount =
      input.uploadedChunkCount ?? this.deriveUploadedChunkCount(uploadStatus, uploadProgress, chunkCount);
    const uploadSessionId = input.uploadSessionId?.trim() || this.createId("upload");
    const lastError = syncState === "sync_failed" || uploadStatus === "failed" ? input.lastError?.trim() || "Upload failed." : null;
    const prisma = this.prisma as unknown as EvidencePrisma;

    const { mediaAsset, evidence } = await prisma.$transaction(async (transaction: EvidencePrisma) => {
      const mediaAsset = await transaction.mediaAsset.create({
        data: {
          id: this.createId("media"),
          organizationId: input.organizationId,
          uploaderUserId: input.uploaderUserId,
          fileName: input.fileName.trim(),
          mimeType: input.mimeType.trim(),
          originalStoragePath: input.originalStoragePath.trim(),
          thumbnailStoragePath: input.thumbnailStoragePath?.trim() || null,
          capturedAt: input.capturedAt,
          uploadStatus,
          syncState,
          uploadSessionId,
          uploadProgress,
          retryCount,
          lastError,
          chunkCount,
          uploadedChunkCount,
          byteSize: input.byteSize,
          width: input.width,
          height: input.height
        }
      });

      const evidence = await transaction.evidencePhoto.create({
        data: {
          id: this.createId("evidence"),
          organizationId: input.organizationId,
          uploaderUserId: input.uploaderUserId,
          taskId: input.taskId,
          visitId: input.visitId ?? null,
          mediaAssetId: mediaAsset.id,
          type: input.type,
          capturedAt: input.capturedAt,
          latitude: input.latitude,
          longitude: input.longitude
        }
      });

      return { mediaAsset, evidence };
    });

    return {
      item: this.toEvidence({
        ...evidence,
        mediaAsset
      }),
      mediaAsset: this.toMediaAsset(mediaAsset),
      message: `Evidence ${evidence.id} captured for task ${evidence.taskId}.`
    };
  }

  async uploadCapturedEvidence(input: UploadCapturedEvidenceInput, actor?: AuthJwtPayload): Promise<EvidenceMutationResult> {
    const references = await this.assertEvidenceReferences(input);
    if (actor) {
      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: input.organizationId,
        userId: input.uploaderUserId,
        assigneeId: references.task.assigneeId,
        provinceId: references.task.provinceId,
        zoneId: references.task.zoneId,
        clientId: references.task.clientId ?? undefined
      });
    }

    const bytes = this.decodeBase64Payload(input.fileBase64);
    const stored = await this.objectStorageService.storeEvidenceCapture({
      organizationId: input.organizationId,
      taskId: input.taskId,
      capturedAt: input.capturedAt,
      fileName: input.fileName,
      mimeType: input.mimeType,
      originalBytes: bytes
    });

    return this.createEvidence({
      organizationId: input.organizationId,
      taskId: input.taskId,
      visitId: input.visitId,
      uploaderUserId: input.uploaderUserId,
      type: input.type,
      capturedAt: input.capturedAt,
      latitude: input.latitude,
      longitude: input.longitude,
      fileName: input.fileName,
      mimeType: input.mimeType,
      originalStoragePath: stored.originalStoragePath,
      thumbnailStoragePath: stored.thumbnailStoragePath,
      uploadStatus: "uploaded",
      syncState: "synced",
      uploadProgress: 100,
      retryCount: 0,
      chunkCount: 1,
      uploadedChunkCount: 1,
      byteSize: input.byteSize ?? bytes.byteLength,
      width: input.width,
      height: input.height
    });
  }

  async updateMediaUploadStatus(id: string, input: UpdateMediaUploadStatusInput, actor?: AuthJwtPayload): Promise<MediaAssetMutationResult> {
    const prisma = this.prisma as unknown as EvidencePrisma;
    const mediaAsset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!mediaAsset) {
      throw new NotFoundException(`Media asset ${id} was not found.`);
    }
    if (actor) {
      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: mediaAsset.organizationId,
        userId: mediaAsset.uploaderUserId
      });
    }

    const currentStatus = mediaAsset.uploadStatus as UploadStatus;
    if (currentStatus !== input.uploadStatus && !ALLOWED_UPLOAD_TRANSITIONS[currentStatus].includes(input.uploadStatus)) {
      throw new BadRequestException(`Media asset ${mediaAsset.id} cannot move from ${mediaAsset.uploadStatus} to ${input.uploadStatus}.`);
    }

    const chunkCount = input.chunkCount ?? mediaAsset.chunkCount ?? DEFAULT_CHUNK_COUNT;
    const uploadProgress = input.uploadProgress ?? this.deriveUploadProgress(input.uploadStatus);
    const uploadedChunkCount =
      input.uploadedChunkCount ?? this.deriveUploadedChunkCount(input.uploadStatus, uploadProgress, chunkCount);
    const syncState = input.syncState ?? this.deriveSyncState(input.uploadStatus);
    const lastError = this.resolveLastError(input, mediaAsset, input.uploadStatus, syncState);

    const updated = await prisma.mediaAsset.update({
      where: { id },
      data: {
        uploadStatus: input.uploadStatus,
        originalStoragePath: input.originalStoragePath?.trim() ?? mediaAsset.originalStoragePath,
        thumbnailStoragePath: input.thumbnailStoragePath?.trim() ?? mediaAsset.thumbnailStoragePath,
        syncState,
        uploadSessionId:
          input.uploadSessionId?.trim() ??
          mediaAsset.uploadSessionId ??
          (input.uploadStatus === "uploaded" ? null : this.createId("upload")),
        uploadProgress,
        retryCount: input.retryCount ?? mediaAsset.retryCount,
        lastError,
        chunkCount,
        uploadedChunkCount
      }
    });

    return {
      item: this.toMediaAsset(updated),
      message: `Media asset ${updated.id} upload status updated to ${updated.uploadStatus}.`
    };
  }

  async requestMediaRetry(id: string, input: RequestMediaRetryInput, actor?: AuthJwtPayload): Promise<MediaAssetMutationResult> {
    const prisma = this.prisma as unknown as EvidencePrisma;
    const mediaAsset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!mediaAsset) {
      throw new NotFoundException(`Media asset ${id} was not found.`);
    }
    if (actor) {
      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: mediaAsset.organizationId,
        userId: mediaAsset.uploaderUserId
      });
    }

    if (mediaAsset.uploadStatus === "uploaded") {
      throw new BadRequestException(`Media asset ${id} has already uploaded successfully and cannot be retried.`);
    }

    const chunkCount = input.chunkCount ?? mediaAsset.chunkCount ?? DEFAULT_CHUNK_COUNT;
    const updated = await prisma.mediaAsset.update({
      where: { id },
      data: {
        uploadStatus: "pending_upload",
        syncState: "pending_sync",
        uploadSessionId: this.createId("upload"),
        uploadProgress: 0,
        retryCount: (mediaAsset.retryCount ?? 0) + 1,
        lastError: input.reason?.trim() ? `Retry requested: ${input.reason.trim()}` : null,
        chunkCount,
        uploadedChunkCount: 0
      }
    });

    return {
      item: this.toMediaAsset(updated),
      message: `Media asset ${updated.id} queued for retry.`
    };
  }

  async assertTaskCompletionRequirements(task: {
    id: string;
    organizationId: string;
    taskTypeId: string;
    activityTypeId: string;
  }) {
    const [workflowRules, evidence] = await Promise.all([
      this.catalogsService.getWorkflowRules(),
      (this.prisma as unknown as EvidencePrisma).evidencePhoto.findMany({
        where: { taskId: task.id },
        include: { mediaAsset: true }
      })
    ]);

    const summary = this.buildRequirementSummary(
      task.id,
      this.resolveWorkflowRule(workflowRules, task.organizationId, task.taskTypeId, task.activityTypeId),
      evidence.map((item: any) => this.toEvidence(item))
    );

    if (!summary.complete) {
      throw new BadRequestException(
        `Task ${task.id} cannot be completed until required evidence is uploaded: ${summary.missingTypes.join(", ")}.`
      );
    }
  }

  private async getRequirementSummaries(
    tasks: Task[],
    evidence: EvidencePhoto[],
    mediaAssets: MediaAsset[],
    workflowRules: WorkflowRule[]
  ): Promise<EvidenceRequirementSummary[]> {
    const evidenceByTask = new Map<string, EvidencePhoto[]>();

    for (const item of evidence) {
      const mediaAsset = mediaAssets.find((asset) => asset.id === item.mediaAssetId);
      const normalizedItem = {
        ...item,
        uploadStatus: mediaAsset?.uploadStatus ?? item.uploadStatus
      };
      const current = evidenceByTask.get(item.taskId) ?? [];
      current.push(normalizedItem);
      evidenceByTask.set(item.taskId, current);
    }

    return tasks.map((task) =>
      this.buildRequirementSummary(
        task.id,
        this.resolveWorkflowRule(workflowRules, task.organizationId, task.taskTypeId, task.activityTypeId),
        evidenceByTask.get(task.id) ?? []
      )
    );
  }

  private buildRequirementSummary(taskId: string, workflowRule: WorkflowRule | undefined, evidence: EvidencePhoto[]) {
    const beforeUploaded = evidence.some((item) => item.type === "before" && item.uploadStatus === "uploaded");
    const afterUploaded = evidence.some((item) => item.type === "after" && item.uploadStatus === "uploaded");
    const supportingCount = evidence.filter((item) => item.type === "supporting" && item.uploadStatus === "uploaded").length;
    const missingTypes = [
      ...(workflowRule?.requiresBeforePhoto && !beforeUploaded ? (["before"] as const) : []),
      ...(workflowRule?.requiresAfterPhoto && !afterUploaded ? (["after"] as const) : [])
    ];

    return {
      taskId,
      requiredBeforePhoto: workflowRule?.requiresBeforePhoto ?? false,
      requiredAfterPhoto: workflowRule?.requiresAfterPhoto ?? false,
      beforeUploaded,
      afterUploaded,
      supportingCount,
      missingTypes: [...missingTypes],
      complete: missingTypes.length === 0
    };
  }

  private buildPendingSyncOperations(mediaAssets: MediaAsset[]): SyncOperation[] {
    return mediaAssets
      .filter((mediaAsset) => mediaAsset.syncState !== "synced" || mediaAsset.uploadStatus !== "uploaded")
      .map((mediaAsset) => ({
        id: `sync_${mediaAsset.id}`,
        type: "photo_upload",
        state: mediaAsset.syncState,
        payload: {
          mediaAssetId: mediaAsset.id,
          uploadSessionId: mediaAsset.uploadSessionId,
          fileName: mediaAsset.fileName,
          progress: mediaAsset.uploadProgress,
          chunkCount: mediaAsset.chunkCount,
          uploadedChunkCount: mediaAsset.uploadedChunkCount
        },
        retryCount: mediaAsset.retryCount,
        createdAt: mediaAsset.capturedAt,
        errorMessage: mediaAsset.lastError
      }));
  }

  private deriveSyncState(uploadStatus: UploadStatus) {
    if (uploadStatus === "uploaded") {
      return "synced" as const;
    }

    if (uploadStatus === "failed") {
      return "sync_failed" as const;
    }

    return "pending_sync" as const;
  }

  private deriveUploadProgress(uploadStatus: UploadStatus) {
    if (uploadStatus === "uploaded") {
      return 100;
    }

    if (uploadStatus === "uploading") {
      return 55;
    }

    return 0;
  }

  private deriveUploadedChunkCount(uploadStatus: UploadStatus, uploadProgress: number, chunkCount: number) {
    if (uploadStatus === "uploaded") {
      return chunkCount;
    }

    if (uploadStatus === "uploading") {
      return Math.max(1, Math.min(chunkCount - 1, Math.round((uploadProgress / 100) * chunkCount)));
    }

    return 0;
  }

  private resolveLastError(
    input: UpdateMediaUploadStatusInput,
    mediaAsset: {
      lastError: string | null;
    },
    uploadStatus: UploadStatus,
    syncState: "pending_sync" | "sync_failed" | "needs_review" | "synced"
  ) {
    if (input.lastError?.trim()) {
      return input.lastError.trim();
    }

    if (uploadStatus === "failed" || syncState === "sync_failed") {
      return mediaAsset.lastError ?? "Upload failed.";
    }

    return null;
  }

  private resolveWorkflowRule(
    workflowRules: WorkflowRule[],
    organizationId: string,
    taskTypeId: string,
    activityTypeId: string
  ) {
    const candidates = workflowRules
      .filter((rule) => rule.organizationId === organizationId)
      .filter(
        (rule) =>
          (rule.taskTypeId === undefined || rule.taskTypeId === taskTypeId) &&
          (rule.activityTypeId === undefined || rule.activityTypeId === activityTypeId)
      );

    return candidates.sort((left, right) => {
      const leftScore = Number(left.taskTypeId === taskTypeId) + Number(left.activityTypeId === activityTypeId);
      const rightScore = Number(right.taskTypeId === taskTypeId) + Number(right.activityTypeId === activityTypeId);
      return rightScore - leftScore;
    })[0];
  }

  private async assertEvidenceReferences(
    input: Pick<CreateEvidenceInput, "organizationId" | "taskId" | "visitId" | "uploaderUserId">
  ) {
    const [task, uploader] = await Promise.all([
      (this.prisma as unknown as EvidencePrisma).task.findFirst({
        where: {
          id: input.taskId,
          organizationId: input.organizationId
        }
      }),
      (this.prisma as unknown as EvidencePrisma).user.findFirst({
        where: {
          id: input.uploaderUserId,
          organizationId: input.organizationId,
          active: true
        }
      })
    ]);

    if (!task) {
      throw new NotFoundException(`Task ${input.taskId} was not found.`);
    }

    if (!uploader) {
      throw new NotFoundException(`Uploader ${input.uploaderUserId} was not found.`);
    }

    if (input.visitId) {
      const visit = await (this.prisma as unknown as EvidencePrisma).visit.findFirst({
        where: {
          id: input.visitId,
          taskId: input.taskId,
          organizationId: input.organizationId
        }
      });

      if (!visit) {
        throw new NotFoundException(`Visit ${input.visitId} was not found for task ${input.taskId}.`);
      }
    }

    return { task, uploader };
  }

  private async getTasks(): Promise<Task[]> {
    const tasks = await (this.prisma as unknown as EvidencePrisma).task.findMany({
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }]
    });

    return tasks.map((task: any) => ({
      id: task.id,
      organizationId: task.organizationId,
      title: task.title,
      requesterId: task.requesterId,
      assigneeId: task.assigneeId,
      scheduledFor: task.scheduledFor,
      provinceId: task.provinceId,
      zoneId: task.zoneId,
      clientId: task.clientId ?? undefined,
      pointOfSaleId: task.pointOfSaleId ?? undefined,
      activityTypeId: task.activityTypeId,
      taskTypeId: task.taskTypeId,
      status: task.status as Task["status"],
      priority: task.priority as Task["priority"],
      difficulty: task.difficulty as Task["difficulty"]
    }));
  }

  private async getVisits(): Promise<Visit[]> {
    const visits = await (this.prisma as unknown as EvidencePrisma).visit.findMany({
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }]
    });

    return visits.map((visit: any) => ({
      id: visit.id,
      organizationId: visit.organizationId,
      taskId: visit.taskId,
      assigneeId: visit.assigneeId,
      scheduledFor: visit.scheduledFor,
      provinceId: visit.provinceId,
      zoneId: visit.zoneId,
      pointOfSaleId: visit.pointOfSaleId ?? undefined,
      status: visit.status as Visit["status"],
      checkedInAt: visit.checkedInAt ?? undefined,
      checkedInLatitude: visit.checkedInLatitude ?? undefined,
      checkedInLongitude: visit.checkedInLongitude ?? undefined,
      checkedOutAt: visit.checkedOutAt ?? undefined,
      checkedOutLatitude: visit.checkedOutLatitude ?? undefined,
      checkedOutLongitude: visit.checkedOutLongitude ?? undefined
    }));
  }

  private toEvidence(evidence: {
    id: string;
    organizationId: string;
    uploaderUserId: string;
    taskId: string;
    visitId: string | null;
    mediaAssetId: string;
    type: string;
    capturedAt: string;
    latitude: number | null;
    longitude: number | null;
    mediaAsset?: { uploadStatus: string };
  }): EvidencePhoto {
    return {
      id: evidence.id,
      organizationId: evidence.organizationId,
      uploaderUserId: evidence.uploaderUserId,
      taskId: evidence.taskId,
      visitId: evidence.visitId ?? undefined,
      mediaAssetId: evidence.mediaAssetId,
      type: evidence.type as EvidencePhoto["type"],
      capturedAt: evidence.capturedAt,
      latitude: evidence.latitude ?? undefined,
      longitude: evidence.longitude ?? undefined,
      uploadStatus: (evidence.mediaAsset?.uploadStatus ?? "pending_upload") as UploadStatus
    };
  }

  private toMediaAsset(mediaAsset: {
    id: string;
    organizationId: string;
    uploaderUserId: string;
    fileName: string;
    mimeType: string;
    originalStoragePath: string;
    thumbnailStoragePath: string | null;
    capturedAt: string;
    uploadStatus: string;
    syncState: string;
    uploadSessionId: string | null;
    uploadProgress: number;
    retryCount: number;
    lastError: string | null;
    chunkCount: number | null;
    uploadedChunkCount: number | null;
    byteSize: number | null;
    width: number | null;
    height: number | null;
  }): MediaAsset {
    return {
      id: mediaAsset.id,
      organizationId: mediaAsset.organizationId,
      uploaderUserId: mediaAsset.uploaderUserId,
      fileName: mediaAsset.fileName,
      mimeType: mediaAsset.mimeType,
      originalStoragePath: this.objectStorageService.createSignedReadPath(mediaAsset.originalStoragePath),
      thumbnailStoragePath: mediaAsset.thumbnailStoragePath
        ? this.objectStorageService.createSignedReadPath(mediaAsset.thumbnailStoragePath)
        : undefined,
      capturedAt: mediaAsset.capturedAt,
      uploadStatus: mediaAsset.uploadStatus as UploadStatus,
      syncState: mediaAsset.syncState as MediaAsset["syncState"],
      uploadSessionId: mediaAsset.uploadSessionId ?? undefined,
      uploadProgress: mediaAsset.uploadProgress,
      retryCount: mediaAsset.retryCount,
      lastError: mediaAsset.lastError ?? undefined,
      chunkCount: mediaAsset.chunkCount ?? undefined,
      uploadedChunkCount: mediaAsset.uploadedChunkCount ?? undefined,
      byteSize: mediaAsset.byteSize ?? undefined,
      width: mediaAsset.width ?? undefined,
      height: mediaAsset.height ?? undefined
    };
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private decodeBase64Payload(fileBase64: string) {
    const normalized = fileBase64.includes(",") ? fileBase64.split(",").pop() ?? "" : fileBase64;
    return Buffer.from(normalized, "base64");
  }
}
