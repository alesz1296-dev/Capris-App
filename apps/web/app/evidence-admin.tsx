"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  t,
  type CreateEvidenceInput,
  type EvidenceBootstrap,
  type EvidencePhoto,
  type EvidenceType,
  type MediaAsset,
  type UploadCapturedEvidenceInput,
  type UploadStatus
} from "@capris/shared";
import { API_BASE_URL, authenticatedFetch, subscribeToAuthChanges } from "./auth-client";
import { textByLocale, useAppLocale } from "./locale-client";

const ORGANIZATION_ID = "org_capris";
const EVIDENCE_TYPES: EvidenceType[] = ["before", "after", "supporting"];
const UPLOAD_NEXT_ACTIONS: Record<UploadStatus, UploadStatus[]> = {
  pending_upload: ["uploading", "uploaded", "failed"],
  uploading: ["uploaded", "failed"],
  uploaded: [],
  failed: ["pending_upload", "uploading", "uploaded"]
};

type EvidenceFormState = {
  taskId: string;
  visitId: string;
  uploaderUserId: string;
  type: EvidenceType;
  fileName: string;
};

const DEFAULT_EVIDENCE_FORM: EvidenceFormState = {
  taskId: "",
  visitId: "",
  uploaderUserId: "",
  type: "before",
  fileName: "launch-display-before.jpg"
};

export function EvidenceAdmin() {
  const locale = useAppLocale();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<EvidenceBootstrap | null>(null);
  const [evidenceForm, setEvidenceForm] = useState<EvidenceFormState>(DEFAULT_EVIDENCE_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const tasks = bootstrap?.tasks ?? [];
  const visits = bootstrap?.visits ?? [];
  const users = bootstrap?.users ?? [];
  const evidence = bootstrap?.evidence ?? [];
  const mediaAssets = bootstrap?.mediaAssets ?? [];
  const requirementSummaries = bootstrap?.requirementSummaries ?? [];
  const pendingSyncOperations = bootstrap?.pendingSyncOperations ?? [];
  const actionDisabled = loading || isPending;

  const visitsForTask = useMemo(() => visits.filter((visit) => visit.taskId === evidenceForm.taskId), [evidenceForm.taskId, visits]);
  const failedMediaAssets = useMemo(() => mediaAssets.filter((mediaAsset) => mediaAsset.uploadStatus === "failed"), [mediaAssets]);

  useEffect(() => {
    void loadEvidence();
    return subscribeToAuthChanges(() => {
      void loadEvidence();
    });
  }, []);

  useEffect(() => {
    if (!evidenceForm.taskId && tasks[0]) {
      setEvidenceForm((current) => ({
        ...current,
        taskId: tasks[0]?.id ?? "",
        visitId: visits.find((visit) => visit.taskId === tasks[0]?.id)?.id ?? "",
        uploaderUserId: current.uploaderUserId || tasks[0]?.assigneeId || ""
      }));
    }
  }, [evidenceForm.taskId, tasks, visits]);

  useEffect(() => {
    const validVisit = visitsForTask.some((visit) => visit.id === evidenceForm.visitId);
    if (!validVisit) {
      setEvidenceForm((current) => ({
        ...current,
        visitId: visitsForTask[0]?.id ?? ""
      }));
    }
  }, [evidenceForm.visitId, visitsForTask]);

  async function loadEvidence() {
    const loadFallback = textByLocale(locale, "Unable to load evidence data.", "No se pudieron cargar los datos de evidencia.");
    try {
      setLoading(true);
      setError(null);

      const response = await authenticatedFetch(`${API_BASE_URL}/evidence/bootstrap`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, loadFallback));
      }

      const payload = (await response.json()) as EvidenceBootstrap;
      setBootstrap(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : loadFallback);
    } finally {
      setLoading(false);
    }
  }

  async function uploadSelectedFile() {
    const selectedTask = tasks.find((task) => task.id === evidenceForm.taskId);
    if (!selectedTask || !evidenceForm.uploaderUserId || !selectedFile) {
      setError(textByLocale(locale, "Select a file before uploading evidence.", "Selecciona un archivo antes de subir evidencia."));
      return;
    }

    const dataUrl = await fileToDataUrl(selectedFile);
    const timestamp = new Date().toISOString();
    const payload: UploadCapturedEvidenceInput = {
      organizationId: ORGANIZATION_ID,
      taskId: evidenceForm.taskId,
      visitId: evidenceForm.visitId || undefined,
      uploaderUserId: evidenceForm.uploaderUserId,
      type: evidenceForm.type,
      capturedAt: timestamp,
      latitude: 9.9186,
      longitude: -84.1397,
      fileName: selectedFile.name || evidenceForm.fileName.trim() || `${selectedTask.id}-${evidenceForm.type}.jpg`,
      mimeType: selectedFile.type || "image/jpeg",
      fileBase64: dataUrl,
      captureSource: "web_file",
      byteSize: selectedFile.size || undefined
    };

    await submitUpload(payload, textByLocale(locale, "Evidence uploaded to object storage successfully.", "Evidencia subida correctamente al almacenamiento de objetos."));
  }

  async function queueEvidence() {
    const selectedTask = tasks.find((task) => task.id === evidenceForm.taskId);
    if (!selectedTask || !evidenceForm.uploaderUserId) {
      return;
    }

    const now = Date.now();
    const timestamp = new Date(now).toISOString();
    const uploadSessionId = `upload_${now}`;
    const payload: CreateEvidenceInput = {
      organizationId: ORGANIZATION_ID,
      taskId: evidenceForm.taskId,
      visitId: evidenceForm.visitId || undefined,
      uploaderUserId: evidenceForm.uploaderUserId,
      type: evidenceForm.type,
      capturedAt: timestamp,
      latitude: 9.9186,
      longitude: -84.1397,
      fileName: evidenceForm.fileName.trim() || `${selectedTask.id}-${evidenceForm.type}.jpg`,
      mimeType: selectedFile?.type || "image/jpeg",
      originalStoragePath: `/local-device/originals/${now}-${evidenceForm.type}.jpg`,
      thumbnailStoragePath: `/local-device/thumbs/${now}-${evidenceForm.type}.jpg`,
      uploadStatus: "pending_upload",
      syncState: "pending_sync",
      uploadSessionId,
      uploadProgress: 0,
      retryCount: 0,
      chunkCount: 4,
      uploadedChunkCount: 0,
      byteSize: selectedFile?.size || 240000,
      width: undefined,
      height: undefined
    };

    try {
      setStatusMessage(null);
      setError(null);

      const response = await authenticatedFetch(`${API_BASE_URL}/evidence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, textByLocale(locale, "Unable to queue evidence.", "No se pudo encolar la evidencia.")));
      }

      setStatusMessage(textByLocale(locale, "Evidence queued for upload successfully.", "Evidencia encolada correctamente para subir."));
      startTransition(() => {
        void loadEvidence();
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : textByLocale(locale, "Unable to queue evidence.", "No se pudo encolar la evidencia."));
    }
  }

  async function submitUpload(payload: UploadCapturedEvidenceInput, successMessage: string) {
    try {
      setStatusMessage(null);
      setError(null);

      const response = await authenticatedFetch(`${API_BASE_URL}/evidence/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Unable to upload evidence."));
      }

      setSelectedFile(null);
      setStatusMessage(successMessage);
      startTransition(() => {
        void loadEvidence();
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload evidence.");
    }
  }

  async function updateUploadStatus(mediaAsset: MediaAsset, nextStatus: UploadStatus) {
    try {
      setStatusMessage(null);
      setError(null);

      const body = buildUploadStatusPayload(mediaAsset, nextStatus);
      const response = await authenticatedFetch(`${API_BASE_URL}/evidence/media/${mediaAsset.id}/upload-status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, textByLocale(locale, "Unable to update upload status.", "No se pudo actualizar el estado de carga.")));
      }

      setStatusMessage(textByLocale(locale, `Media asset moved to ${nextStatus}.`, `Activo multimedia movido a ${nextStatus}.`));
      startTransition(() => {
        void loadEvidence();
      });
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : textByLocale(locale, "Unable to update upload status.", "No se pudo actualizar el estado de carga."));
    }
  }

  async function requestRetry(mediaAsset: MediaAsset, reason?: string) {
    try {
      setStatusMessage(null);
      setError(null);

      const response = await authenticatedFetch(`${API_BASE_URL}/evidence/media/${mediaAsset.id}/retry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reason,
          chunkCount: mediaAsset.chunkCount ?? 4
        })
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, textByLocale(locale, "Unable to queue retry.", "No se pudo encolar el reintento.")));
      }

      setStatusMessage(textByLocale(locale, `Retry queued for ${mediaAsset.fileName}.`, `Reintento encolado para ${mediaAsset.fileName}.`));
      startTransition(() => {
        void loadEvidence();
      });
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : textByLocale(locale, "Unable to queue retry.", "No se pudo encolar el reintento."));
    }
  }

  return (
    <section className="catalogSection" id="evidence">
      <div className="sectionHeading">
        <p className="eyebrow">{t(locale, "evidence.title")}</p>
        <h2>{t(locale, "evidence.sectionTitle")}</h2>
        <p className="sectionDescription">{t(locale, "evidence.sectionDescription")}</p>
        <button className="secondaryAction sectionAction" disabled={actionDisabled} type="button" onClick={() => void loadEvidence()}>
          {actionDisabled ? textByLocale(locale, "Refreshing...", "Actualizando...") : textByLocale(locale, "Refresh evidence", "Actualizar evidencia")}
        </button>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">{textByLocale(locale, "Loading evidence data...", "Cargando datos de evidencia...")}</p> : null}
        {isPending ? <p className="feedbackInfo">{textByLocale(locale, "Refreshing evidence state from API...", "Actualizando estado de evidencia desde la API...")}</p> : null}
        {statusMessage ? <p className="feedbackSuccess">{statusMessage}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
      </div>

      <div className="taskAdminLayout">
        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{t(locale, "evidence.create")}</h3>
              <p>{textByLocale(locale, "Select a real image file to upload through the evidence API into object storage, or queue the metadata-only variant to keep the sync path visible.", "Selecciona una imagen real para subirla por la API de evidencia al almacenamiento de objetos, o encola la variante solo con metadatos para mantener visible la ruta de sincronizacion.")}</p>
            </div>
          </div>

          <div className="formGrid">
            <label className="fullWidth">
              <span>{textByLocale(locale, "Task", "Tarea")}</span>
              <select
                value={evidenceForm.taskId}
                onChange={(event) =>
                  setEvidenceForm((current) => ({
                    ...current,
                    taskId: event.target.value,
                    uploaderUserId: tasks.find((task) => task.id === event.target.value)?.assigneeId ?? current.uploaderUserId
                  }))
                }
              >
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{textByLocale(locale, "Visit", "Visita")}</span>
              <select value={evidenceForm.visitId} onChange={(event) => setEvidenceForm((current) => ({ ...current, visitId: event.target.value }))}>
                <option value="">{textByLocale(locale, "No visit link", "Sin vinculacion de visita")}</option>
                {visitsForTask.map((visit) => (
                  <option key={visit.id} value={visit.id}>
                    {visit.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t(locale, "evidence.uploader")}</span>
              <select
                value={evidenceForm.uploaderUserId}
                onChange={(event) => setEvidenceForm((current) => ({ ...current, uploaderUserId: event.target.value }))}
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t(locale, "evidence.type")}</span>
              <select
                value={evidenceForm.type}
                onChange={(event) => setEvidenceForm((current) => ({ ...current, type: event.target.value as EvidenceType }))}
              >
                {EVIDENCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(locale, `evidence.type.${type}` as never)}
                  </option>
                ))}
              </select>
            </label>
            <label className="fullWidth">
              <span>{t(locale, "evidence.fileName")}</span>
              <input value={evidenceForm.fileName} onChange={(event) => setEvidenceForm((current) => ({ ...current, fileName: event.target.value }))} />
            </label>
            <label className="fullWidth">
              <span>{textByLocale(locale, "Select image", "Seleccionar imagen")}</span>
              <input
                accept="image/*"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  if (file) {
                    setEvidenceForm((current) => ({
                      ...current,
                      fileName: file.name
                    }));
                  }
                }}
              />
            </label>
            <div className="taskFormActions fullWidth">
              <button className="primaryAction" disabled={actionDisabled || !selectedFile} type="button" onClick={() => void uploadSelectedFile()}>
                {actionDisabled ? textByLocale(locale, "Uploading...", "Subiendo...") : textByLocale(locale, "Upload selected file", "Subir archivo seleccionado")}
              </button>
              <button className="secondaryAction" disabled={actionDisabled} type="button" onClick={() => void queueEvidence()}>
                {textByLocale(locale, "Queue metadata-only upload", "Encolar carga solo de metadatos")}
              </button>
            </div>
          </div>
        </article>

        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{t(locale, "evidence.reviewStub")}</h3>
              <p>{textByLocale(locale, "Review thumbnails, upload progress, retry counts, and pending-sync operations. Real stored thumbnails now render through the storage endpoint whenever the upload has completed.", "Revisa miniaturas, progreso de carga, conteos de reintento y operaciones pendientes de sincronizacion. Las miniaturas almacenadas ya se muestran por el endpoint de almacenamiento cuando la carga se completa.")}</p>
            </div>
          </div>

          <div className="evidenceOpsSummary">
            <div className="evidenceOpsMetric">
              <strong>{pendingSyncOperations.length}</strong>
              <span>Pending sync operations</span>
            </div>
            <div className="evidenceOpsMetric">
              <strong>{failedMediaAssets.length}</strong>
              <span>Failed uploads ready for retry</span>
            </div>
            <div className="evidenceOpsMetric">
              <strong>{mediaAssets.filter((item) => item.uploadStatus === "uploading").length}</strong>
              <span>Uploads currently in progress</span>
            </div>
          </div>

          {pendingSyncOperations.length > 0 ? (
            <div className="syncQueuePanel">
              {pendingSyncOperations.map((operation) => (
                <div className="syncQueueRow" key={operation.id}>
                  <div>
                    <strong>{operation.type}</strong>
                    <p>{JSON.stringify(operation.payload)}</p>
                  </div>
                  <span className="taskBadge">{operation.state}</span>
                </div>
              ))}
            </div>
          ) : null}

          {evidence.length > 0 ? (
            <div className="taskList">
              {evidence.map((item) => (
                <EvidenceCard
                  key={item.id}
                  evidence={item}
                  mediaAsset={mediaAssets.find((mediaAsset) => mediaAsset.id === item.mediaAssetId)}
                  taskTitle={tasks.find((task) => task.id === item.taskId)?.title ?? item.taskId}
                  requirementSummary={requirementSummaries.find((summary) => summary.taskId === item.taskId)}
                  actionDisabled={actionDisabled}
                  onUploadStatusChange={updateUploadStatus}
                  onRetry={requestRetry}
                />
              ))}
            </div>
          ) : (
            <p className="catalogEmptyState">{t(locale, "evidence.none")}</p>
          )}
        </article>
      </div>
    </section>
  );
}

function EvidenceCard({
  evidence,
  mediaAsset,
  taskTitle,
  requirementSummary,
  actionDisabled,
  onUploadStatusChange,
  onRetry
}: {
  evidence: EvidencePhoto;
  mediaAsset: EvidenceBootstrap["mediaAssets"][number] | undefined;
  taskTitle: string;
  requirementSummary: EvidenceBootstrap["requirementSummaries"][number] | undefined;
  actionDisabled: boolean;
  onUploadStatusChange: (mediaAsset: MediaAsset, nextStatus: UploadStatus) => Promise<void>;
  onRetry: (mediaAsset: MediaAsset, reason?: string) => Promise<void>;
}) {
  const locale = useAppLocale();
  const uploadStatus = mediaAsset?.uploadStatus ?? evidence.uploadStatus;
  const missingTypes = requirementSummary?.missingTypes ?? [];
  const previewSrc = createThumbnailPreview(mediaAsset, evidence.type);

  return (
    <article className="taskCard">
      <div className="taskCardHeader">
        <div>
          <h4>{taskTitle}</h4>
          <p>
            {t(locale, `evidence.type.${evidence.type}` as never)} / {t(locale, `uploadStatus.${uploadStatus}` as never)}
          </p>
        </div>
        <span className="taskBadge">{mediaAsset?.fileName ?? evidence.id}</span>
      </div>

      <div className="evidencePreviewLayout">
        <div className="evidenceThumbnailFrame">
          <img alt={`${evidence.type} preview`} className="evidenceThumbnail" src={previewSrc} />
        </div>

        <div className="evidenceReviewDetails">
          <dl className="taskMetaGrid">
            <div>
              <dt>{t(locale, "evidence.capturedAt")}</dt>
              <dd>{evidence.capturedAt}</dd>
            </div>
            <div>
              <dt>{t(locale, "evidence.originalPath")}</dt>
              <dd>{mediaAsset?.originalStoragePath ?? "Pending"}</dd>
            </div>
            <div>
              <dt>{t(locale, "evidence.thumbnailPath")}</dt>
              <dd>{mediaAsset?.thumbnailStoragePath ?? "Pending"}</dd>
            </div>
            <div>
              <dt>{t(locale, "evidence.uploadStatus")}</dt>
              <dd>{t(locale, `uploadStatus.${uploadStatus}` as never)}</dd>
            </div>
            <div>
              <dt>{t(locale, "evidence.requirements")}</dt>
              <dd>{missingTypes.length > 0 ? `Missing: ${missingTypes.join(", ")}` : "Complete"}</dd>
            </div>
            <div>
              <dt>Visit link</dt>
              <dd>{evidence.visitId ?? "Task-only evidence"}</dd>
            </div>
            <div>
              <dt>Sync state</dt>
              <dd>{mediaAsset?.syncState ?? "pending_sync"}</dd>
            </div>
            <div>
              <dt>Upload session</dt>
              <dd>{mediaAsset?.uploadSessionId ?? "Not assigned"}</dd>
            </div>
            <div>
              <dt>Retries</dt>
              <dd>{mediaAsset?.retryCount ?? 0}</dd>
            </div>
          </dl>

          <div className="evidenceProgressPanel">
            <div className="evidenceProgressHeader">
              <strong>Upload progress</strong>
              <span>{Math.round(mediaAsset?.uploadProgress ?? 0)}%</span>
            </div>
            <div className="evidenceProgressBar">
              <span style={{ width: `${Math.max(4, mediaAsset?.uploadProgress ?? 0)}%` }} />
            </div>
            <p className="evidenceProgressCopy">
              Chunks: {mediaAsset?.uploadedChunkCount ?? 0} / {mediaAsset?.chunkCount ?? 0}
            </p>
            {mediaAsset?.lastError ? <p className="feedbackError evidenceInlineError">{mediaAsset.lastError}</p> : null}
          </div>
        </div>
      </div>

      {mediaAsset ? (
        <div className="taskStatusActions">
          {mediaAsset.uploadStatus === "failed" ? (
            <button className="primaryAction" disabled={actionDisabled} type="button" onClick={() => void onRetry(mediaAsset, "Manual review retry from web console")}>
              Queue retry
            </button>
          ) : null}
          {UPLOAD_NEXT_ACTIONS[uploadStatus].map((nextStatus) => (
            <button
              key={nextStatus}
              className="secondaryAction"
              disabled={actionDisabled}
              type="button"
              onClick={() => void onUploadStatusChange(mediaAsset, nextStatus)}
            >
              Move to {t(locale, `uploadStatus.${nextStatus}` as never)}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function buildUploadStatusPayload(mediaAsset: MediaAsset, nextStatus: UploadStatus) {
  const chunkCount = mediaAsset.chunkCount ?? 4;
  const uploadSessionId = nextStatus === "uploaded" ? mediaAsset.uploadSessionId : mediaAsset.uploadSessionId ?? `upload_${Date.now()}`;

  if (nextStatus === "uploaded") {
    return {
      uploadStatus: nextStatus,
      syncState: "synced",
      uploadSessionId,
      uploadProgress: 100,
      retryCount: mediaAsset.retryCount,
      chunkCount,
      uploadedChunkCount: chunkCount
    };
  }

  if (nextStatus === "uploading") {
    return {
      uploadStatus: nextStatus,
      syncState: "pending_sync",
      uploadSessionId,
      uploadProgress: Math.max(35, mediaAsset.uploadProgress || 0),
      retryCount: mediaAsset.retryCount,
      chunkCount,
      uploadedChunkCount: Math.max(1, Math.min(chunkCount - 1, mediaAsset.uploadedChunkCount ?? 1))
    };
  }

  if (nextStatus === "failed") {
    return {
      uploadStatus: nextStatus,
      syncState: "sync_failed",
      uploadSessionId,
      uploadProgress: mediaAsset.uploadProgress,
      retryCount: mediaAsset.retryCount,
      chunkCount,
      uploadedChunkCount: mediaAsset.uploadedChunkCount ?? 0,
      lastError: "Upload interrupted while transferring thumbnail chunks."
    };
  }

  return {
    uploadStatus: nextStatus,
    syncState: "pending_sync",
    uploadSessionId,
    uploadProgress: 0,
    retryCount: mediaAsset.retryCount,
    chunkCount,
    uploadedChunkCount: 0
  };
}

function createThumbnailPreview(mediaAsset: MediaAsset | undefined, evidenceType: EvidenceType) {
  if (mediaAsset?.thumbnailStoragePath?.startsWith("/api/v1/storage/")) {
    return `${API_BASE_URL.replace("/api/v1", "")}${mediaAsset.thumbnailStoragePath}`;
  }

  const label = `${evidenceType.toUpperCase()} / ${mediaAsset?.uploadStatus ?? "pending_upload"}`;
  const background = mediaAsset?.uploadStatus === "uploaded" ? "#dff2e7" : mediaAsset?.uploadStatus === "failed" ? "#fde4e1" : "#edf6f1";
  const ink = mediaAsset?.uploadStatus === "failed" ? "#8a2f27" : "#15533e";
  const encoded = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="220">
      <rect width="100%" height="100%" fill="${background}" rx="16" ry="16"/>
      <rect x="18" y="18" width="284" height="184" fill="white" opacity="0.72" rx="12" ry="12"/>
      <text x="24" y="54" font-family="Segoe UI, sans-serif" font-size="18" font-weight="700" fill="${ink}">${label}</text>
      <text x="24" y="92" font-family="Segoe UI, sans-serif" font-size="14" fill="${ink}">${mediaAsset?.fileName ?? "pending-capture.jpg"}</text>
      <text x="24" y="128" font-family="Segoe UI, sans-serif" font-size="14" fill="${ink}">Progress ${Math.round(mediaAsset?.uploadProgress ?? 0)}%</text>
      <text x="24" y="164" font-family="Segoe UI, sans-serif" font-size="13" fill="${ink}">Session ${mediaAsset?.uploadSessionId ?? "not-started"}</text>
    </svg>
  `);

  return `data:image/svg+xml;charset=UTF-8,${encoded}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(`${reader.result ?? ""}`);
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function extractErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(payload.message)) {
      return payload.message.join(" ");
    }

    if (payload.message) {
      return payload.message;
    }
  }

  const text = await response.text();
  return text || fallback;
}

