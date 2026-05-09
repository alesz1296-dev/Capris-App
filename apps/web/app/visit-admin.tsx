"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { t, type Visit, type VisitBootstrap, type VisitStatus } from "@capris/shared";
import type { CreateVisitInput } from "@capris/shared";
import { API_BASE_URL, authenticatedFetch, subscribeToAuthChanges } from "./auth-client";
import { useAppLocale } from "./locale-client";

const ORGANIZATION_ID = "org_capris";
const FALLBACK_LATITUDE = 9.9186;
const FALLBACK_LONGITUDE = -84.1397;

type VisitFormState = {
  taskId: string;
  scheduledFor: string;
};

const DEFAULT_VISIT_FORM: VisitFormState = {
  taskId: "",
  scheduledFor: "2026-05-08"
};

const VISIT_ACTIONS: Record<VisitStatus, Array<"check_in" | "check_out">> = {
  scheduled: ["check_in"],
  checked_in: ["check_out"],
  checked_out: []
};

export function VisitAdmin() {
  const locale = useAppLocale();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<VisitBootstrap | null>(null);
  const [visitForm, setVisitForm] = useState<VisitFormState>(DEFAULT_VISIT_FORM);

  const tasks = bootstrap?.tasks ?? [];
  const visits = bootstrap?.visits ?? [];
  const users = bootstrap?.users ?? [];
  const provinces = bootstrap?.provinces.filter((province) => province.active) ?? [];
  const zones = bootstrap?.zones.filter((zone) => zone.active) ?? [];
  const pointsOfSale = bootstrap?.pointsOfSale.filter((pointOfSale) => pointOfSale.active) ?? [];
  const actionDisabled = loading || isPending;

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === visitForm.taskId) ?? null,
    [tasks, visitForm.taskId]
  );

  const visitsByDate = useMemo(() => {
    return [...visits].sort((left, right) => {
      if (left.scheduledFor !== right.scheduledFor) {
        return left.scheduledFor.localeCompare(right.scheduledFor);
      }

      return left.status.localeCompare(right.status);
    });
  }, [visits]);

  useEffect(() => {
    void loadVisits();
    return subscribeToAuthChanges(() => {
      void loadVisits();
    });
  }, []);

  useEffect(() => {
    if (!visitForm.taskId && tasks[0]) {
      setVisitForm((current) => ({
        ...current,
        taskId: tasks[0]?.id ?? "",
        scheduledFor: tasks[0]?.scheduledFor ?? current.scheduledFor
      }));
    }
  }, [tasks, visitForm.taskId]);

  async function loadVisits() {
    try {
      setLoading(true);
      setError(null);

      const response = await authenticatedFetch(`${API_BASE_URL}/visits/bootstrap`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Unable to load visit data."));
      }

      const payload = (await response.json()) as VisitBootstrap;
      setBootstrap(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load visit data.");
    } finally {
      setLoading(false);
    }
  }

  async function submitVisit() {
    if (!selectedTask) {
      return;
    }

    const payload: CreateVisitInput = {
      organizationId: ORGANIZATION_ID,
      taskId: selectedTask.id,
      assigneeId: selectedTask.assigneeId,
      scheduledFor: visitForm.scheduledFor,
      provinceId: selectedTask.provinceId,
      zoneId: selectedTask.zoneId,
      pointOfSaleId: selectedTask.pointOfSaleId
    };

    try {
      setStatusMessage(null);
      setError(null);

      const response = await authenticatedFetch(`${API_BASE_URL}/visits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Unable to create visit."));
      }

      setStatusMessage("Visit created successfully.");
      setVisitForm({
        taskId: selectedTask.id,
        scheduledFor: selectedTask.scheduledFor
      });
      startTransition(() => {
        void loadVisits();
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create visit.");
    }
  }

  async function transitionVisit(visit: Visit, action: "check_in" | "check_out") {
    const linkedPointOfSale = pointsOfSale.find((pointOfSale) => pointOfSale.id === visit.pointOfSaleId);
    const latitude = linkedPointOfSale?.latitude ?? FALLBACK_LATITUDE;
    const longitude = linkedPointOfSale?.longitude ?? FALLBACK_LONGITUDE;
    const endpoint = action === "check_in" ? "check-in" : "check-out";
    const payload =
      action === "check_in"
        ? {
            checkedInAt: new Date().toISOString(),
            checkedInLatitude: latitude,
            checkedInLongitude: longitude
          }
        : {
            checkedOutAt: new Date().toISOString(),
            checkedOutLatitude: latitude,
            checkedOutLongitude: longitude
          };

    try {
      setStatusMessage(null);
      setError(null);

      const response = await authenticatedFetch(`${API_BASE_URL}/visits/${visit.id}/${endpoint}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, `Unable to ${endpoint} visit.`));
      }

      setStatusMessage(action === "check_in" ? `Visit ${visit.id} checked in.` : `Visit ${visit.id} checked out.`);
      startTransition(() => {
        void loadVisits();
      });
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : `Unable to ${endpoint} visit.`);
    }
  }

  return (
    <section className="catalogSection" id="routes">
      <div className="sectionHeading">
        <p className="eyebrow">{t(locale, "visits.title")}</p>
        <h2>{t(locale, "visits.sectionTitle")}</h2>
        <p className="sectionDescription">{t(locale, "visits.sectionDescription")}</p>
        <button className="secondaryAction sectionAction" disabled={actionDisabled} type="button" onClick={() => void loadVisits()}>
          {actionDisabled ? "Refreshing..." : "Refresh route day"}
        </button>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">Loading visit data...</p> : null}
        {isPending ? <p className="feedbackInfo">Refreshing visit state from API...</p> : null}
        {statusMessage ? <p className="feedbackSuccess">{statusMessage}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
      </div>

      <div className="taskAdminLayout">
        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>Create task-linked visit</h3>
              <p>Visits inherit assignee and route scope from the selected task so route execution stays aligned with the task plan.</p>
            </div>
          </div>

          <div className="formGrid">
            <label className="fullWidth">
              <span>Task</span>
              <select
                value={visitForm.taskId}
                onChange={(event) => {
                  const task = tasks.find((item) => item.id === event.target.value);
                  setVisitForm({
                    taskId: event.target.value,
                    scheduledFor: task?.scheduledFor ?? visitForm.scheduledFor
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
              <span>{t(locale, "tasks.scheduledFor")}</span>
              <input
                type="date"
                value={visitForm.scheduledFor}
                onChange={(event) => setVisitForm((current) => ({ ...current, scheduledFor: event.target.value }))}
              />
            </label>
            <label>
              <span>{t(locale, "tasks.assignee")}</span>
              <input
                disabled
                value={selectedTask ? users.find((user) => user.id === selectedTask.assigneeId)?.name ?? selectedTask.assigneeId : ""}
              />
            </label>
            <label>
              <span>Province</span>
              <input
                disabled
                value={selectedTask ? provinces.find((province) => province.id === selectedTask.provinceId)?.name ?? selectedTask.provinceId : ""}
              />
            </label>
            <label>
              <span>Zone</span>
              <input
                disabled
                value={selectedTask ? zones.find((zone) => zone.id === selectedTask.zoneId)?.name ?? selectedTask.zoneId : ""}
              />
            </label>
            <label>
              <span>{t(locale, "tasks.pointOfSale")}</span>
              <input
                disabled
                value={
                  selectedTask
                    ? pointsOfSale.find((pointOfSale) => pointOfSale.id === selectedTask.pointOfSaleId)?.name ??
                      selectedTask.pointOfSaleId ??
                      ""
                    : ""
                }
              />
            </label>
            <div className="taskFormActions fullWidth">
              <button className="primaryAction" disabled={actionDisabled || !selectedTask} type="button" onClick={submitVisit}>
                {actionDisabled ? "Saving..." : "Create visit"}
              </button>
            </div>
          </div>
        </article>

        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{t(locale, "visits.routeDay")}</h3>
              <p>Check in and check out route stops from the same visit list the field app will consume.</p>
            </div>
          </div>

          {visitsByDate.length > 0 ? (
            <div className="taskList">
              {visitsByDate.map((visit) => (
                <VisitCard
                  key={visit.id}
                  visit={visit}
                  tasks={tasks}
                  users={users}
                  provinces={provinces}
                  zones={zones}
                  pointsOfSale={pointsOfSale}
                  actionDisabled={actionDisabled}
                  onTransition={transitionVisit}
                />
              ))}
            </div>
          ) : (
            <p className="catalogEmptyState">{t(locale, "visits.none")}</p>
          )}
        </article>
      </div>
    </section>
  );
}

function VisitCard({
  visit,
  tasks,
  users,
  provinces,
  zones,
  pointsOfSale,
  actionDisabled,
  onTransition
}: {
  visit: Visit;
  tasks: VisitBootstrap["tasks"];
  users: VisitBootstrap["users"];
  provinces: VisitBootstrap["provinces"];
  zones: VisitBootstrap["zones"];
  pointsOfSale: VisitBootstrap["pointsOfSale"];
  actionDisabled: boolean;
  onTransition: (visit: Visit, action: "check_in" | "check_out") => Promise<void>;
}) {
  const locale = useAppLocale();
  const linkedTask = tasks.find((task) => task.id === visit.taskId);
  const assignee = users.find((user) => user.id === visit.assigneeId)?.name ?? visit.assigneeId;
  const province = provinces.find((item) => item.id === visit.provinceId)?.name ?? visit.provinceId;
  const zone = zones.find((item) => item.id === visit.zoneId)?.name ?? visit.zoneId;
  const pointOfSale = pointsOfSale.find((item) => item.id === visit.pointOfSaleId)?.name ?? "Route stop not linked";

  return (
    <article className="taskCard">
      <div className="taskCardHeader">
        <div>
          <h4>{linkedTask?.title ?? visit.taskId}</h4>
          <p>
            {t(locale, "visits.status")}: {t(locale, `visitStatus.${visit.status}` as never)}
          </p>
        </div>
        <span className="taskBadge">{visit.scheduledFor}</span>
      </div>

      <dl className="taskMetaGrid">
        <div>
          <dt>{t(locale, "tasks.assignee")}</dt>
          <dd>{assignee}</dd>
        </div>
        <div>
          <dt>Route</dt>
          <dd>
            {province} / {zone}
          </dd>
        </div>
        <div>
          <dt>{t(locale, "tasks.pointOfSale")}</dt>
          <dd>{pointOfSale}</dd>
        </div>
        <div>
          <dt>{t(locale, "visits.checkedInAt")}</dt>
          <dd>{visit.checkedInAt ?? "Pending"}</dd>
        </div>
        <div>
          <dt>{t(locale, "visits.checkedOutAt")}</dt>
          <dd>{visit.checkedOutAt ?? "Pending"}</dd>
        </div>
        <div>
          <dt>GPS</dt>
          <dd>
            {visit.checkedOutLatitude ?? visit.checkedInLatitude ?? FALLBACK_LATITUDE},{" "}
            {visit.checkedOutLongitude ?? visit.checkedInLongitude ?? FALLBACK_LONGITUDE}
          </dd>
        </div>
      </dl>

      <div className="taskStatusActions">
        {VISIT_ACTIONS[visit.status].map((action) => (
          <button
            key={action}
            className="secondaryAction"
            disabled={actionDisabled}
            type="button"
            onClick={() => void onTransition(visit, action)}
          >
            {action === "check_in" ? t(locale, "visits.checkIn") : t(locale, "visits.checkOut")}
          </button>
        ))}
      </div>
    </article>
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

