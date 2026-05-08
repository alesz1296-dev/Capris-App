"use client";

import { useEffect, useMemo, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import {
  t,
  type Activity,
  type Consignation,
  type CreateActivityInput,
  type CreateExhibitionInstallationInput,
  type EvidenceBootstrap,
  type ExhibitionInstallation,
  type ReviewConsignationInput
} from "@capris/shared";
import { API_BASE_URL, authenticatedFetch, subscribeToAuthChanges } from "./auth-client";

const ORGANIZATION_ID = "org_capris";

type ActivityFormState = {
  taskId: string;
  visitId: string;
  pointOfSaleId: string;
  userId: string;
  quantity: number;
  note: string;
};

type ConsignationReviewState = {
  id: string;
  recipientEmails: string;
  emailSubject: string;
  emailBody: string;
  beforeEvidenceId: string;
  afterEvidenceId: string;
};

const EMPTY_ACTIVITY_FORM: ActivityFormState = {
  taskId: "",
  visitId: "",
  pointOfSaleId: "",
  userId: "",
  quantity: 1,
  note: ""
};

export function ActivitiesAdmin() {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<EvidenceBootstrap | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [exhibitions, setExhibitions] = useState<ExhibitionInstallation[]>([]);
  const [activityForm, setActivityForm] = useState<ActivityFormState>(EMPTY_ACTIVITY_FORM);
  const [exhibitionForm, setExhibitionForm] = useState<ActivityFormState>(EMPTY_ACTIVITY_FORM);
  const [reviewState, setReviewState] = useState<Record<string, ConsignationReviewState>>({});

  const tasks = bootstrap?.tasks ?? [];
  const visits = bootstrap?.visits ?? [];
  const users = bootstrap?.users ?? [];
  const pointsOfSale = bootstrap?.pointsOfSale ?? [];
  const consignations = bootstrap?.consignations ?? [];
  const evidence = bootstrap?.evidence ?? [];
  const actionDisabled = loading || isPending;

  const activityVisits = useMemo(() => visits.filter((visit) => visit.taskId === activityForm.taskId), [activityForm.taskId, visits]);
  const exhibitionVisits = useMemo(() => visits.filter((visit) => visit.taskId === exhibitionForm.taskId), [exhibitionForm.taskId, visits]);

  useEffect(() => {
    void loadActivities();
    return subscribeToAuthChanges(() => {
      void loadActivities();
    });
  }, []);

  useEffect(() => {
    const defaultTask = tasks[0];
    if (defaultTask && !activityForm.taskId) {
      setActivityForm({
        taskId: defaultTask.id,
        visitId: visits.find((visit) => visit.taskId === defaultTask.id)?.id ?? "",
        pointOfSaleId: defaultTask.pointOfSaleId ?? "",
        userId: defaultTask.assigneeId,
        quantity: 1,
        note: ""
      });
      setExhibitionForm({
        taskId: defaultTask.id,
        visitId: visits.find((visit) => visit.taskId === defaultTask.id)?.id ?? "",
        pointOfSaleId: defaultTask.pointOfSaleId ?? "",
        userId: defaultTask.assigneeId,
        quantity: 1,
        note: ""
      });
    }
  }, [activityForm.taskId, tasks, visits]);

  async function loadActivities() {
    try {
      setLoading(true);
      setError(null);
      const [evidenceResponse, activitiesResponse, exhibitionsResponse] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/evidence/bootstrap`, { cache: "no-store" }),
        authenticatedFetch(`${API_BASE_URL}/activities`, { cache: "no-store" }),
        authenticatedFetch(`${API_BASE_URL}/exhibitions`, { cache: "no-store" })
      ]);

      if (!evidenceResponse.ok) {
        throw new Error(await extractErrorMessage(evidenceResponse, "Unable to load activity context."));
      }
      if (!activitiesResponse.ok) {
        throw new Error(await extractErrorMessage(activitiesResponse, "Unable to load activities."));
      }
      if (!exhibitionsResponse.ok) {
        throw new Error(await extractErrorMessage(exhibitionsResponse, "Unable to load exhibitions."));
      }

      const [bootstrapPayload, activityPayload, exhibitionPayload] = await Promise.all([
        evidenceResponse.json() as Promise<EvidenceBootstrap>,
        activitiesResponse.json() as Promise<Activity[]>,
        exhibitionsResponse.json() as Promise<ExhibitionInstallation[]>
      ]);

      setBootstrap(bootstrapPayload);
      setActivities(activityPayload);
      setExhibitions(exhibitionPayload);
      setReviewState(buildReviewState(bootstrapPayload.consignations));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load activities.");
    } finally {
      setLoading(false);
    }
  }

  async function submitActivityRecord() {
    const payload: CreateActivityInput = {
      organizationId: ORGANIZATION_ID,
      taskId: activityForm.taskId,
      visitId: activityForm.visitId || undefined,
      pointOfSaleId: activityForm.pointOfSaleId || undefined,
      userId: activityForm.userId,
      quantity: activityForm.quantity,
      note: activityForm.note || undefined,
      recordedAt: new Date().toISOString()
    };

    await submitWorkflowAction(`${API_BASE_URL}/activities`, payload, "Activity recorded.");
  }

  async function submitExhibition() {
    const payload: CreateExhibitionInstallationInput = {
      organizationId: ORGANIZATION_ID,
      taskId: exhibitionForm.taskId,
      visitId: exhibitionForm.visitId || undefined,
      pointOfSaleId: exhibitionForm.pointOfSaleId || undefined,
      userId: exhibitionForm.userId,
      quantity: exhibitionForm.quantity,
      note: exhibitionForm.note || undefined,
      recordedAt: new Date().toISOString()
    };

    await submitWorkflowAction(`${API_BASE_URL}/exhibitions`, payload, "Exhibition installation recorded.");
  }

  async function reviewConsignation(consignation: Consignation) {
    const current = reviewState[consignation.id];
    if (!current) {
      return;
    }

    const payload: ReviewConsignationInput = {
      reviewedAt: new Date().toISOString(),
      recipientEmails: current.recipientEmails.split(",").map((email) => email.trim()).filter(Boolean),
      emailSubject: current.emailSubject,
      emailBody: current.emailBody,
      beforeEvidenceId: current.beforeEvidenceId || undefined,
      afterEvidenceId: current.afterEvidenceId || undefined
    };

    await submitWorkflowAction(`${API_BASE_URL}/consignations/${consignation.id}/review`, payload, "Consignation reviewed and ready to send.", "PATCH");
  }

  async function sendConsignation(consignation: Consignation) {
    await submitWorkflowAction(
      `${API_BASE_URL}/consignations/${consignation.id}/send`,
      { sentAt: new Date().toISOString() },
      "Consignation marked as sent.",
      "PATCH"
    );
  }

  async function failConsignation(consignation: Consignation) {
    await submitWorkflowAction(
      `${API_BASE_URL}/consignations/${consignation.id}/fail`,
      { failedAt: new Date().toISOString(), reason: "Manual failure captured from review console." },
      "Consignation marked as failed.",
      "PATCH"
    );
  }

  async function submitWorkflowAction(url: string, payload: unknown, successMessage: string, method: "POST" | "PATCH" = "POST") {
    try {
      setStatusMessage(null);
      setError(null);

      const response = await authenticatedFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Unable to save activity workflow."));
      }

      setStatusMessage(successMessage);
      startTransition(() => {
        void loadActivities();
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save activity workflow.");
    }
  }

  return (
    <section className="catalogSection" id="activities">
      <div className="sectionHeading">
        <p className="eyebrow">Session 10</p>
        <h2>Consignations, activities, and exhibitions</h2>
        <p className="sectionDescription">Review consignation emails before sending and record activity counts tied to real tasks, visits, and points of sale.</p>
        <button className="secondaryAction sectionAction" disabled={actionDisabled} type="button" onClick={() => void loadActivities()}>
          {actionDisabled ? "Refreshing..." : "Refresh activities"}
        </button>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">Loading activity workflows...</p> : null}
        {isPending ? <p className="feedbackInfo">Refreshing activity state from API...</p> : null}
        {statusMessage ? <p className="feedbackSuccess">{statusMessage}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
      </div>

      <div className="taskAdminLayout">
        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{t("en", "activity.activities")}</h3>
              <p>Capture how many activities were completed for each field task.</p>
            </div>
          </div>
          <ActivityForm
            form={activityForm}
            onChange={setActivityForm}
            pointsOfSale={pointsOfSale}
            tasks={tasks}
            users={users}
            visits={activityVisits}
          />
          <div className="taskFormActions">
            <button className="primaryAction" disabled={actionDisabled} type="button" onClick={() => void submitActivityRecord()}>
              {t("en", "activity.recordActivity")}
            </button>
          </div>
          <ActivityList items={activities.map((item) => ({ ...item, label: "Activity" }))} />
        </article>

        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{t("en", "activity.exhibitions")}</h3>
              <p>Record installed exhibition counts by execution visit or direct point of sale linkage.</p>
            </div>
          </div>
          <ActivityForm
            form={exhibitionForm}
            onChange={setExhibitionForm}
            pointsOfSale={pointsOfSale}
            tasks={tasks}
            users={users}
            visits={exhibitionVisits}
          />
          <div className="taskFormActions">
            <button className="primaryAction" disabled={actionDisabled} type="button" onClick={() => void submitExhibition()}>
              {t("en", "activity.recordExhibition")}
            </button>
          </div>
          <ActivityList items={exhibitions.map((item) => ({ ...item, label: "Exhibition" }))} />
        </article>
      </div>

      <article className="catalogManagerCard">
        <div className="catalogManagerHeader">
          <div>
            <h3>{t("en", "consignation.reviewSend")}</h3>
            <p>Move consignations from prepared to reviewed, capture recipient/content details, and track send failures before the later email-job slice lands.</p>
          </div>
        </div>

        <div className="taskList">
          {consignations.map((consignation) => {
            const current = reviewState[consignation.id] ?? buildReviewState([consignation])[consignation.id];
            const taskEvidence = evidence.filter((item) => item.taskId === consignation.taskId);
            return (
              <article className="taskCard" key={consignation.id}>
                <div className="taskCardHeader">
                  <div>
                    <h4>{consignation.id}</h4>
                    <p>{t("en", `consignation.status.${consignation.status}` as never)}</p>
                  </div>
                  <span className="taskBadge">{consignation.taskId}</span>
                </div>

                <div className="formGrid">
                  <label className="fullWidth">
                    <span>{t("en", "consignation.recipients")}</span>
                    <input
                      value={current.recipientEmails}
                      onChange={(event) => updateReviewState(consignation.id, { recipientEmails: event.target.value }, setReviewState)}
                    />
                  </label>
                  <label className="fullWidth">
                    <span>{t("en", "consignation.subject")}</span>
                    <input
                      value={current.emailSubject}
                      onChange={(event) => updateReviewState(consignation.id, { emailSubject: event.target.value }, setReviewState)}
                    />
                  </label>
                  <label className="fullWidth">
                    <span>{t("en", "consignation.body")}</span>
                    <textarea
                      value={current.emailBody}
                      onChange={(event) => updateReviewState(consignation.id, { emailBody: event.target.value }, setReviewState)}
                    />
                  </label>
                  <label>
                    <span>{t("en", "consignation.beforeEvidence")}</span>
                    <select
                      value={current.beforeEvidenceId}
                      onChange={(event) => updateReviewState(consignation.id, { beforeEvidenceId: event.target.value }, setReviewState)}
                    >
                      <option value="">Select before evidence</option>
                      {taskEvidence
                        .filter((item) => item.type === "before")
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.id}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    <span>{t("en", "consignation.afterEvidence")}</span>
                    <select
                      value={current.afterEvidenceId}
                      onChange={(event) => updateReviewState(consignation.id, { afterEvidenceId: event.target.value }, setReviewState)}
                    >
                      <option value="">Select after evidence</option>
                      {taskEvidence
                        .filter((item) => item.type === "after")
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.id}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                <div className="taskStatusActions">
                  <button className="secondaryAction" disabled={actionDisabled} type="button" onClick={() => void reviewConsignation(consignation)}>
                    {t("en", "consignation.review")}
                  </button>
                  <button className="primaryAction" disabled={actionDisabled} type="button" onClick={() => void sendConsignation(consignation)}>
                    {t("en", "consignation.send")}
                  </button>
                  <button className="secondaryAction" disabled={actionDisabled} type="button" onClick={() => void failConsignation(consignation)}>
                    {t("en", "consignation.fail")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </article>
    </section>
  );
}

function ActivityForm({
  form,
  onChange,
  tasks,
  visits,
  users,
  pointsOfSale
}: {
  form: ActivityFormState;
  onChange: (next: ActivityFormState) => void;
  tasks: EvidenceBootstrap["tasks"];
  visits: EvidenceBootstrap["visits"];
  users: EvidenceBootstrap["users"];
  pointsOfSale: EvidenceBootstrap["pointsOfSale"];
}) {
  return (
    <div className="formGrid">
      <label className="fullWidth">
        <span>Task</span>
        <select
          value={form.taskId}
          onChange={(event) => {
            const task = tasks.find((item) => item.id === event.target.value);
            onChange({
              ...form,
              taskId: event.target.value,
              visitId: visits.find((visit) => visit.taskId === event.target.value)?.id ?? "",
              pointOfSaleId: task?.pointOfSaleId ?? "",
              userId: task?.assigneeId ?? form.userId
            });
          }}
        >
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Visit</span>
        <select value={form.visitId} onChange={(event) => onChange({ ...form, visitId: event.target.value })}>
          <option value="">No visit link</option>
          {visits.map((visit) => (
            <option key={visit.id} value={visit.id}>
              {visit.id}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t("en", "tasks.pointOfSale")}</span>
        <select value={form.pointOfSaleId} onChange={(event) => onChange({ ...form, pointOfSaleId: event.target.value })}>
          <option value="">No POS link</option>
          {pointsOfSale.map((pointOfSale) => (
            <option key={pointOfSale.id} value={pointOfSale.id}>
              {pointOfSale.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t("en", "evidence.uploader")}</span>
        <select value={form.userId} onChange={(event) => onChange({ ...form, userId: event.target.value })}>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t("en", "activity.quantity")}</span>
        <input
          min={1}
          type="number"
          value={form.quantity}
          onChange={(event) => onChange({ ...form, quantity: Number(event.target.value || 1) })}
        />
      </label>
      <label className="fullWidth">
        <span>{t("en", "activity.note")}</span>
        <input value={form.note} onChange={(event) => onChange({ ...form, note: event.target.value })} />
      </label>
    </div>
  );
}

function ActivityList({
  items
}: {
  items: Array<{ id: string; taskId: string; quantity: number; recordedAt: string; note?: string; label: string }>;
}) {
  return (
    <div className="taskList">
      {items.map((item) => (
        <article className="taskCard" key={item.id}>
          <div className="taskCardHeader">
            <div>
              <h4>{item.label}</h4>
              <p>{item.recordedAt}</p>
            </div>
            <span className="taskBadge">x{item.quantity}</span>
          </div>
          <p>{item.taskId}</p>
          {item.note ? <p>{item.note}</p> : null}
        </article>
      ))}
    </div>
  );
}

function buildReviewState(consignations: Consignation[]) {
  return Object.fromEntries(
    consignations.map((consignation) => [
      consignation.id,
      {
        id: consignation.id,
        recipientEmails: consignation.recipientEmails.join(", "),
        emailSubject: consignation.emailSubject ?? `Consignation evidence for ${consignation.taskId}`,
        emailBody:
          consignation.emailBody ??
          `Attached are the before and after consignation photos for task ${consignation.taskId}.`,
        beforeEvidenceId: consignation.beforeEvidenceId ?? "",
        afterEvidenceId: consignation.afterEvidenceId ?? ""
      } satisfies ConsignationReviewState
    ])
  );
}

function updateReviewState(
  id: string,
  patch: Partial<ConsignationReviewState>,
  setReviewState: Dispatch<SetStateAction<Record<string, ConsignationReviewState>>>
) {
  setReviewState((current) => ({
    ...current,
    [id]: {
      ...current[id],
      ...patch
    }
  }));
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
