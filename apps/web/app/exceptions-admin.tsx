"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  AuthProfileResponse,
  DeviceSessionBootstrap,
  ExceptionBootstrap,
  ExceptionRecord,
  ExceptionStatus,
  ExceptionType
} from "@capris/shared";
import { t } from "@capris/shared";
import { API_BASE_URL, authenticatedFetch, subscribeToAuthChanges } from "./auth-client";
import { textByLocale, useAppLocale } from "./locale-client";

const ORGANIZATION_ID = "org_capris";

const EXCEPTION_TYPES: ExceptionType[] = [
  "missing_gps",
  "poor_signal",
  "closed_store",
  "unavailable_contact",
  "failed_photo_upload",
  "failed_email_send",
  "off_route_visit",
  "missing_required_evidence"
];

const REVIEW_STATUSES: Extract<ExceptionStatus, "approved" | "rejected" | "needs_correction">[] = [
  "approved",
  "rejected",
  "needs_correction"
];

function reviewStatusLabel(locale: "en" | "es", status: Extract<ExceptionStatus, "approved" | "rejected" | "needs_correction">) {
  return textByLocale(
    locale,
    status.replaceAll("_", " "),
    {
      approved: "aprobada",
      rejected: "rechazada",
      needs_correction: "requiere correccion"
    }[status]
  );
}

function exceptionStatusLabel(locale: "en" | "es", status: ExceptionStatus) {
  return textByLocale(
    locale,
    status.replaceAll("_", " "),
    {
      submitted: "enviada",
      approved: "aprobada",
      rejected: "rechazada",
      needs_correction: "requiere correccion"
    }[status]
  );
}

type ExceptionFormState = {
  type: ExceptionType;
  title: string;
  description: string;
  taskId: string;
  visitId: string;
  mediaAssetId: string;
  consignationId: string;
};

const EMPTY_FORM: ExceptionFormState = {
  type: "missing_gps",
  title: "",
  description: "",
  taskId: "",
  visitId: "",
  mediaAssetId: "",
  consignationId: ""
};

export function ExceptionsAdmin() {
  const locale = useAppLocale();
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<ExceptionBootstrap | null>(null);
  const [deviceSessions, setDeviceSessions] = useState<DeviceSessionBootstrap | null>(null);
  const [profile, setProfile] = useState<AuthProfileResponse | null>(null);
  const [form, setForm] = useState<ExceptionFormState>(EMPTY_FORM);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadExceptions();
    return subscribeToAuthChanges(() => {
      void loadExceptions();
    });
  }, []);

  const canReview = profile?.user.role === "admin" || profile?.user.role === "supervisor";
  const canRevokeSessions = profile?.user.role === "admin";

  const activeSessions = useMemo(
    () => deviceSessions?.sessions.filter((session) => session.active) ?? [],
    [deviceSessions]
  );

  async function loadExceptions() {
    try {
      setLoading(true);
      setError(null);

      const profileResponse = await authenticatedFetch(`${API_BASE_URL}/auth/me`, { cache: "no-store" });
      if (!profileResponse.ok) {
        throw new Error(await extractErrorMessage(profileResponse, textByLocale(locale, "Unable to load auth profile.", "No se pudo cargar el perfil de autenticacion.")));
      }

      const profilePayload = (await profileResponse.json()) as AuthProfileResponse;
      const [exceptionsResponse, sessionsResponse] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/exceptions/bootstrap`, { cache: "no-store" }),
        profilePayload.user.role === "admin"
          ? authenticatedFetch(`${API_BASE_URL}/auth/sessions`, { cache: "no-store" })
          : Promise.resolve(null)
      ]);

      if (!exceptionsResponse.ok) {
        throw new Error(await extractErrorMessage(exceptionsResponse, textByLocale(locale, "Unable to load exceptions.", "No se pudieron cargar las excepciones.")));
      }
      if (sessionsResponse && !sessionsResponse.ok) {
        throw new Error(await extractErrorMessage(sessionsResponse, textByLocale(locale, "Unable to load device sessions.", "No se pudieron cargar las sesiones de dispositivo.")));
      }

      const [exceptionsPayload, sessionsPayload] = await Promise.all([
        exceptionsResponse.json() as Promise<ExceptionBootstrap>,
        sessionsResponse ? (sessionsResponse.json() as Promise<DeviceSessionBootstrap>) : Promise.resolve(null)
      ]);

      setBootstrap(exceptionsPayload);
      setDeviceSessions(sessionsPayload);
      setProfile(profilePayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : textByLocale(locale, "Unable to load exceptions and device sessions.", "No se pudieron cargar las excepciones y sesiones de dispositivo."));
    } finally {
      setLoading(false);
    }
  }

  async function createException() {
    if (!profile) {
      setError(textByLocale(locale, "Sign in before submitting exceptions.", "Inicia sesion antes de enviar excepciones."));
      return;
    }

    await submit(
      `${API_BASE_URL}/exceptions`,
      {
        organizationId: ORGANIZATION_ID,
        type: form.type,
        title: form.title,
        description: form.description || undefined,
        submittedByUserId: profile.user.id,
        taskId: form.taskId || undefined,
        visitId: form.visitId || undefined,
        mediaAssetId: form.mediaAssetId || undefined,
        consignationId: form.consignationId || undefined,
        submittedAt: new Date().toISOString()
      },
      textByLocale(locale, "Exception submitted.", "Excepcion enviada.")
    );
    setForm(EMPTY_FORM);
  }

  async function reviewException(item: ExceptionRecord, status: Extract<ExceptionStatus, "approved" | "rejected" | "needs_correction">) {
    if (!profile) {
      setError(textByLocale(locale, "Sign in before reviewing exceptions.", "Inicia sesion antes de revisar excepciones."));
      return;
    }

    await submit(
      `${API_BASE_URL}/exceptions/${item.id}/review`,
      {
        status,
        reviewedByUserId: profile.user.id,
        reviewNote: reviewNotes[item.id] || undefined,
        reviewedAt: new Date().toISOString()
      },
      textByLocale(locale, `Exception ${item.id} reviewed as ${status}.`, `Excepcion ${item.id} revisada como ${exceptionStatusLabel(locale, status)}.`),
      "PATCH"
    );
  }

  async function revokeSession(id: string) {
    if (!profile) {
      setError(textByLocale(locale, "Sign in before revoking sessions.", "Inicia sesion antes de revocar sesiones."));
      return;
    }

    await submit(
      `${API_BASE_URL}/auth/sessions/${id}/revoke`,
      {
        revokedByUserId: profile.user.id,
        revokedAt: new Date().toISOString()
      },
      textByLocale(locale, `Device session ${id} revoked.`, `Sesion de dispositivo ${id} revocada.`),
      "PATCH"
    );
  }

  async function submit(url: string, payload: unknown, successMessage: string, method: "POST" | "PATCH" = "POST") {
    try {
      setStatusMessage(null);
      setError(null);

      const response = await authenticatedFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, textByLocale(locale, "Unable to save exception or session data.", "No se pudieron guardar los datos de excepciones o sesiones.")));
      }

      setStatusMessage(successMessage);
      startTransition(() => {
        void loadExceptions();
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : textByLocale(locale, "Unable to save exception or session data.", "No se pudieron guardar los datos de excepciones o sesiones."));
    }
  }

  return (
    <section className="catalogSection" id="exceptions">
      <div className="sectionHeading">
        <h2>{textByLocale(locale, "Exceptions, approvals, and device sessions", "Excepciones, aprobaciones y sesiones de dispositivo")}</h2>
        <p className="sectionDescription">
          {textByLocale(locale, "Supervisors can review field exceptions, and admins can revoke active device sessions when access needs to be cut off quickly.", "Los supervisores pueden revisar excepciones de campo y los administradores pueden revocar sesiones activas cuando sea necesario cortar acceso rapidamente.")}
        </p>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">{textByLocale(locale, "Loading exceptions and device sessions...", "Cargando excepciones y sesiones de dispositivo...")}</p> : null}
        {isPending ? <p className="feedbackInfo">{textByLocale(locale, "Refreshing exceptions and device sessions from API...", "Actualizando excepciones y sesiones de dispositivo desde la API...")}</p> : null}
        {statusMessage ? <p className="feedbackSuccess">{statusMessage}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
      </div>

      <div className="metrics">
        <article className="metric">
          <span>{textByLocale(locale, "Submitted exceptions", "Excepciones enviadas")}</span>
          <strong>{bootstrap?.exceptions.length ?? 0}</strong>
        </article>
        <article className="metric">
          <span>{textByLocale(locale, "Needs correction", "Requieren correccion")}</span>
          <strong>{bootstrap?.exceptions.filter((item) => item.status === "needs_correction").length ?? 0}</strong>
        </article>
        <article className="metric">
          <span>{textByLocale(locale, "Active sessions", "Sesiones activas")}</span>
          <strong>{activeSessions.length}</strong>
        </article>
        <article className="metric">
          <span>{textByLocale(locale, "Signed-in role", "Rol con sesion iniciada")}</span>
          <strong>{profile?.user.role ?? textByLocale(locale, "unknown", "desconocido")}</strong>
        </article>
      </div>

      <div className="taskAdminLayout">
        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{textByLocale(locale, "Submit field exception", "Enviar excepcion de campo")}</h3>
              <p>{textByLocale(locale, "Capture missing GPS, closed-store, upload, off-route, and consignation delivery issues from the live workflow context.", "Captura problemas de GPS faltante, tienda cerrada, cargas fallidas, visitas fuera de ruta y entrega de consignacion desde el flujo operativo en vivo.")}</p>
            </div>
          </div>
          <div className="formGrid">
            <label>
              <span>{textByLocale(locale, "Type", "Tipo")}</span>
              <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as ExceptionType }))}>
                {EXCEPTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(locale, `exceptions.type.${type}` as never)}
                  </option>
                ))}
              </select>
            </label>
            <label className="fullWidth">
              <span>{textByLocale(locale, "Title", "Titulo")}</span>
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="fullWidth">
              <span>{textByLocale(locale, "Description", "Descripcion")}</span>
              <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label>
              <span>{textByLocale(locale, "Task", "Tarea")}</span>
              <select value={form.taskId} onChange={(event) => setForm((current) => ({ ...current, taskId: event.target.value }))}>
                <option value="">{textByLocale(locale, "No task", "Sin tarea")}</option>
                {bootstrap?.tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{textByLocale(locale, "Visit", "Visita")}</span>
              <select value={form.visitId} onChange={(event) => setForm((current) => ({ ...current, visitId: event.target.value }))}>
                <option value="">{textByLocale(locale, "No visit", "Sin visita")}</option>
                {bootstrap?.visits
                  .filter((visit) => !form.taskId || visit.taskId === form.taskId)
                  .map((visit) => (
                    <option key={visit.id} value={visit.id}>
                      {visit.id} / {textByLocale(locale, visit.status, visit.status === "planned" ? "planificada" : visit.status === "in_progress" ? "en progreso" : visit.status === "completed" ? "completada" : "cancelada")}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>{textByLocale(locale, "Media asset", "Activo multimedia")}</span>
              <select value={form.mediaAssetId} onChange={(event) => setForm((current) => ({ ...current, mediaAssetId: event.target.value }))}>
                <option value="">{textByLocale(locale, "No media asset", "Sin activo multimedia")}</option>
                {bootstrap?.mediaAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.fileName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{textByLocale(locale, "Consignation", "Consignacion")}</span>
              <select value={form.consignationId} onChange={(event) => setForm((current) => ({ ...current, consignationId: event.target.value }))}>
                <option value="">{textByLocale(locale, "No consignation", "Sin consignacion")}</option>
                {bootstrap?.consignations
                  .filter((consignation) => !form.taskId || consignation.taskId === form.taskId)
                  .map((consignation) => (
                    <option key={consignation.id} value={consignation.id}>
                      {consignation.id} / {textByLocale(locale, consignation.status, consignation.status === "prepared" ? "preparada" : consignation.status === "ready_to_send" ? "lista para enviar" : consignation.status === "sent" ? "enviada" : "fallida")}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="taskFormActions">
            <button className="primaryAction" disabled={loading || isPending || !profile} type="button" onClick={() => void createException()}>
              {textByLocale(locale, "Submit exception", "Enviar excepcion")}
            </button>
          </div>
        </article>

        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{textByLocale(locale, "Supervisor review queue", "Cola de revision del supervisor")}</h3>
              <p>{textByLocale(locale, "Approve, reject, or request correction on operational exceptions before they escalate into reporting gaps.", "Aprueba, rechaza o solicita correcciones en excepciones operativas antes de que se conviertan en vacios de reporte.")}</p>
            </div>
          </div>
          <div className="taskList">
            {bootstrap?.exceptions.map((item) => (
              <article className="taskCard" key={item.id}>
                <div className="taskCardHeader">
                  <div>
                    <h4>{item.title}</h4>
                    <p>
                      {t(locale, `exceptions.type.${item.type}` as never)} / {textByLocale(locale, "submitted", "enviada")} {item.submittedAt}
                    </p>
                  </div>
                  <span className="taskBadge">{exceptionStatusLabel(locale, item.status)}</span>
                </div>
                {item.description ? <p>{item.description}</p> : null}
                <p>
                  {textByLocale(locale, "Task", "Tarea")}: {item.taskId ?? "n/a"} / {textByLocale(locale, "Visit", "Visita")}: {item.visitId ?? "n/a"} / {textByLocale(locale, "Media", "Media")}: {item.mediaAssetId ?? "n/a"} / {textByLocale(locale, "Consignation", "Consignacion")}: {item.consignationId ?? "n/a"}
                </p>
                {item.reviewNote ? <p>{textByLocale(locale, "Review note", "Nota de revision")}: {item.reviewNote}</p> : null}
                {canReview && (item.status === "submitted" || item.status === "needs_correction") ? (
                  <>
                    <label className="fullWidth">
                      <span>{textByLocale(locale, "Review note", "Nota de revision")}</span>
                      <textarea
                        value={reviewNotes[item.id] ?? ""}
                        onChange={(event) => setReviewNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                      />
                    </label>
                    <div className="taskStatusActions">
                      {REVIEW_STATUSES.map((status) => (
                        <button
                          key={status}
                          className={status === "approved" ? "primaryAction" : "secondaryAction"}
                          type="button"
                          onClick={() => void reviewException(item, status)}
                        >
                          {reviewStatusLabel(locale, status)}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </article>
            ))}
          </div>
        </article>
      </div>

      <article className="catalogManagerCard" id="device-sessions">
        <div className="catalogManagerHeader">
          <div>
              <h3>{textByLocale(locale, "Active device sessions", "Sesiones activas de dispositivo")}</h3>
              <p>{textByLocale(locale, "Admins can revoke stale browser or device sessions without waiting for refresh-token expiry.", "Los administradores pueden revocar sesiones viejas de navegador o dispositivo sin esperar a que expire el token de refresco.")}</p>
            </div>
          </div>
        {!canRevokeSessions ? <p className="feedbackInfo">{textByLocale(locale, "Sign in as an admin to revoke active sessions.", "Inicia sesion como administrador para revocar sesiones activas.")}</p> : null}
        <div className="taskList">
          {deviceSessions?.sessions.map((session) => (
            <article className="taskCard" key={session.id}>
              <div className="taskCardHeader">
                <div>
                  <h4>{session.userName}</h4>
                  <p>
                    {session.deviceName ?? textByLocale(locale, "Unknown device", "Dispositivo desconocido")} / {session.provider}
                  </p>
                </div>
                <span className="taskBadge">{session.active ? textByLocale(locale, "active", "activa") : textByLocale(locale, "revoked", "revocada")}</span>
              </div>
              <p>
                {session.userEmail} / {textByLocale(locale, "Created", "Creada")} {session.createdAt}
              </p>
              <p>
                {textByLocale(locale, "Last used", "Ultimo uso")} {session.lastUsedAt ?? "n/a"} / {textByLocale(locale, "Expires", "Expira")} {session.expiresAt}
              </p>
              {canRevokeSessions && session.active ? (
                <div className="taskStatusActions">
                  <button className="secondaryAction" type="button" onClick={() => void revokeSession(session.id)}>
                    {textByLocale(locale, "Revoke session", "Revocar sesion")}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </article>
    </section>
  );
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
