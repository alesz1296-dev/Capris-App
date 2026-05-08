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
import { API_BASE_URL, authenticatedFetch, subscribeToAuthChanges } from "./auth-client";

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
    void loadSession14();
    return subscribeToAuthChanges(() => {
      void loadSession14();
    });
  }, []);

  const canReview = profile?.user.role === "admin" || profile?.user.role === "supervisor";
  const canRevokeSessions = profile?.user.role === "admin";

  const activeSessions = useMemo(
    () => deviceSessions?.sessions.filter((session) => session.active) ?? [],
    [deviceSessions]
  );

  async function loadSession14() {
    try {
      setLoading(true);
      setError(null);

      const [exceptionsResponse, sessionsResponse, profileResponse] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/exceptions/bootstrap`, { cache: "no-store" }),
        authenticatedFetch(`${API_BASE_URL}/auth/sessions`, { cache: "no-store" }),
        authenticatedFetch(`${API_BASE_URL}/auth/me`, { cache: "no-store" })
      ]);

      if (!exceptionsResponse.ok) {
        throw new Error(await extractErrorMessage(exceptionsResponse, "Unable to load exceptions."));
      }
      if (!sessionsResponse.ok) {
        throw new Error(await extractErrorMessage(sessionsResponse, "Unable to load device sessions."));
      }
      if (!profileResponse.ok) {
        throw new Error(await extractErrorMessage(profileResponse, "Unable to load auth profile."));
      }

      const [exceptionsPayload, sessionsPayload, profilePayload] = await Promise.all([
        exceptionsResponse.json() as Promise<ExceptionBootstrap>,
        sessionsResponse.json() as Promise<DeviceSessionBootstrap>,
        profileResponse.json() as Promise<AuthProfileResponse>
      ]);

      setBootstrap(exceptionsPayload);
      setDeviceSessions(sessionsPayload);
      setProfile(profilePayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Session 14 data.");
    } finally {
      setLoading(false);
    }
  }

  async function createException() {
    if (!profile) {
      setError("Sign in before submitting exceptions.");
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
      "Exception submitted."
    );
    setForm(EMPTY_FORM);
  }

  async function reviewException(item: ExceptionRecord, status: Extract<ExceptionStatus, "approved" | "rejected" | "needs_correction">) {
    if (!profile) {
      setError("Sign in before reviewing exceptions.");
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
      `Exception ${item.id} reviewed as ${status}.`,
      "PATCH"
    );
  }

  async function revokeSession(id: string) {
    if (!profile) {
      setError("Sign in before revoking sessions.");
      return;
    }

    await submit(
      `${API_BASE_URL}/auth/sessions/${id}/revoke`,
      {
        revokedByUserId: profile.user.id,
        revokedAt: new Date().toISOString()
      },
      `Device session ${id} revoked.`,
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
        throw new Error(await extractErrorMessage(response, "Unable to save Session 14 data."));
      }

      setStatusMessage(successMessage);
      startTransition(() => {
        void loadSession14();
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save Session 14 data.");
    }
  }

  return (
    <section className="catalogSection" id="exceptions">
      <div className="sectionHeading">
        <p className="eyebrow">Session 14</p>
        <h2>Exceptions, approvals, and device sessions</h2>
        <p className="sectionDescription">
          Supervisors can review field exceptions, and admins can revoke active device sessions when access needs to be cut off quickly.
        </p>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">Loading exceptions and device sessions...</p> : null}
        {isPending ? <p className="feedbackInfo">Refreshing Session 14 state from API...</p> : null}
        {statusMessage ? <p className="feedbackSuccess">{statusMessage}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
      </div>

      <div className="metrics">
        <article className="metric">
          <span>Submitted exceptions</span>
          <strong>{bootstrap?.exceptions.length ?? 0}</strong>
        </article>
        <article className="metric">
          <span>Needs correction</span>
          <strong>{bootstrap?.exceptions.filter((item) => item.status === "needs_correction").length ?? 0}</strong>
        </article>
        <article className="metric">
          <span>Active sessions</span>
          <strong>{activeSessions.length}</strong>
        </article>
        <article className="metric">
          <span>Signed-in role</span>
          <strong>{profile?.user.role ?? "unknown"}</strong>
        </article>
      </div>

      <div className="taskAdminLayout">
        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>Submit field exception</h3>
              <p>Capture missing GPS, closed-store, upload, off-route, and consignation delivery issues from the live workflow context.</p>
            </div>
          </div>
          <div className="formGrid">
            <label>
              <span>Type</span>
              <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as ExceptionType }))}>
                {EXCEPTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="fullWidth">
              <span>Title</span>
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="fullWidth">
              <span>Description</span>
              <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label>
              <span>Task</span>
              <select value={form.taskId} onChange={(event) => setForm((current) => ({ ...current, taskId: event.target.value }))}>
                <option value="">No task</option>
                {bootstrap?.tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Visit</span>
              <select value={form.visitId} onChange={(event) => setForm((current) => ({ ...current, visitId: event.target.value }))}>
                <option value="">No visit</option>
                {bootstrap?.visits
                  .filter((visit) => !form.taskId || visit.taskId === form.taskId)
                  .map((visit) => (
                    <option key={visit.id} value={visit.id}>
                      {visit.id} / {visit.status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>Media asset</span>
              <select value={form.mediaAssetId} onChange={(event) => setForm((current) => ({ ...current, mediaAssetId: event.target.value }))}>
                <option value="">No media asset</option>
                {bootstrap?.mediaAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.fileName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Consignation</span>
              <select value={form.consignationId} onChange={(event) => setForm((current) => ({ ...current, consignationId: event.target.value }))}>
                <option value="">No consignation</option>
                {bootstrap?.consignations
                  .filter((consignation) => !form.taskId || consignation.taskId === form.taskId)
                  .map((consignation) => (
                    <option key={consignation.id} value={consignation.id}>
                      {consignation.id} / {consignation.status}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="taskFormActions">
            <button className="primaryAction" disabled={loading || isPending || !profile} type="button" onClick={() => void createException()}>
              Submit exception
            </button>
          </div>
        </article>

        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>Supervisor review queue</h3>
              <p>Approve, reject, or request correction on operational exceptions before they escalate into reporting gaps.</p>
            </div>
          </div>
          <div className="taskList">
            {bootstrap?.exceptions.map((item) => (
              <article className="taskCard" key={item.id}>
                <div className="taskCardHeader">
                  <div>
                    <h4>{item.title}</h4>
                    <p>
                      {item.type} / submitted {item.submittedAt}
                    </p>
                  </div>
                  <span className="taskBadge">{item.status}</span>
                </div>
                {item.description ? <p>{item.description}</p> : null}
                <p>
                  Task: {item.taskId ?? "n/a"} / Visit: {item.visitId ?? "n/a"} / Media: {item.mediaAssetId ?? "n/a"} / Consignation:{" "}
                  {item.consignationId ?? "n/a"}
                </p>
                {item.reviewNote ? <p>Review note: {item.reviewNote}</p> : null}
                {canReview && (item.status === "submitted" || item.status === "needs_correction") ? (
                  <>
                    <label className="fullWidth">
                      <span>Review note</span>
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
                          {status}
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
            <h3>Active device sessions</h3>
            <p>Admins can revoke stale browser or device sessions without waiting for refresh-token expiry.</p>
          </div>
        </div>
        {!canRevokeSessions ? <p className="feedbackInfo">Sign in as an admin to revoke active sessions.</p> : null}
        <div className="taskList">
          {deviceSessions?.sessions.map((session) => (
            <article className="taskCard" key={session.id}>
              <div className="taskCardHeader">
                <div>
                  <h4>{session.userName}</h4>
                  <p>
                    {session.deviceName ?? "Unknown device"} / {session.provider}
                  </p>
                </div>
                <span className="taskBadge">{session.active ? "active" : "revoked"}</span>
              </div>
              <p>
                {session.userEmail} / Created {session.createdAt}
              </p>
              <p>
                Last used {session.lastUsedAt ?? "n/a"} / Expires {session.expiresAt}
              </p>
              {canRevokeSessions && session.active ? (
                <div className="taskStatusActions">
                  <button className="secondaryAction" type="button" onClick={() => void revokeSession(session.id)}>
                    Revoke session
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
