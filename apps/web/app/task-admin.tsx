"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DIFFICULTIES,
  PRIORITIES,
  TASK_STATUSES,
  t,
  type Difficulty,
  type Priority,
  type Task,
  type TaskBootstrap,
  type TaskStatus
} from "@capris/shared";
import type { CreateTaskInput, UpdateTaskInput } from "@capris/shared";
import { API_BASE_URL, authenticatedFetch, subscribeToAuthChanges } from "./auth-client";

const ORGANIZATION_ID = "org_capris";

type TaskFormState = {
  title: string;
  requesterId: string;
  assigneeId: string;
  scheduledFor: string;
  provinceId: string;
  zoneId: string;
  clientId: string;
  pointOfSaleId: string;
  activityTypeId: string;
  taskTypeId: string;
  priority: Priority;
  difficulty: Difficulty;
};

type TaskFilterState = {
  status: "all" | TaskStatus;
  assigneeId: "all" | string;
  sortBy: "scheduledForAsc" | "scheduledForDesc" | "priorityDesc" | "status";
};

const STATUS_FLOW: Record<TaskStatus, TaskStatus[]> = {
  pending: ["in_progress", "completed"],
  in_progress: ["completed"],
  completed: []
};

const PRIORITY_RANK: Record<Priority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3
};

const DEFAULT_TASK_FORM: TaskFormState = {
  title: "",
  requesterId: "",
  assigneeId: "",
  scheduledFor: "2026-05-08",
  provinceId: "",
  zoneId: "",
  clientId: "",
  pointOfSaleId: "",
  activityTypeId: "",
  taskTypeId: "",
  priority: "medium",
  difficulty: "standard"
};

export function TaskAdmin() {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<TaskBootstrap | null>(null);
  const [taskForm, setTaskForm] = useState<TaskFormState>(DEFAULT_TASK_FORM);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilterState>({
    status: "all",
    assigneeId: "all",
    sortBy: "scheduledForAsc"
  });

  const users = bootstrap?.users ?? [];
  const provinces = bootstrap?.provinces.filter((province) => province.active) ?? [];
  const zones = bootstrap?.zones.filter((zone) => zone.active) ?? [];
  const clients = bootstrap?.clients.filter((client) => client.active) ?? [];
  const pointsOfSale = bootstrap?.pointsOfSale.filter((pointOfSale) => pointOfSale.active) ?? [];
  const activityTypes = bootstrap?.activityTypes.filter((activityType) => activityType.active) ?? [];
  const taskTypes = bootstrap?.taskTypes.filter((taskType) => taskType.active) ?? [];
  const tasks = bootstrap?.tasks ?? [];
  const actionDisabled = loading || isPending;

  const zonesForProvince = useMemo(
    () => zones.filter((zone) => zone.provinceId === taskForm.provinceId),
    [taskForm.provinceId, zones]
  );
  const clientsForZone = useMemo(() => clients, [clients]);
  const pointsOfSaleForScope = useMemo(
    () =>
      pointsOfSale.filter(
        (pointOfSale) =>
          pointOfSale.provinceId === taskForm.provinceId &&
          pointOfSale.zoneId === taskForm.zoneId &&
          (!taskForm.clientId || pointOfSale.clientId === taskForm.clientId)
      ),
    [pointsOfSale, taskForm.clientId, taskForm.provinceId, taskForm.zoneId]
  );

  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      const statusMatches = filters.status === "all" || task.status === filters.status;
      const assigneeMatches = filters.assigneeId === "all" || task.assigneeId === filters.assigneeId;
      return statusMatches && assigneeMatches;
    });

    const sorted = [...filtered];
    sorted.sort((left, right) => {
      if (filters.sortBy === "scheduledForAsc") {
        return left.scheduledFor.localeCompare(right.scheduledFor);
      }

      if (filters.sortBy === "scheduledForDesc") {
        return right.scheduledFor.localeCompare(left.scheduledFor);
      }

      if (filters.sortBy === "priorityDesc") {
        return PRIORITY_RANK[right.priority] - PRIORITY_RANK[left.priority];
      }

      return left.status.localeCompare(right.status);
    });

    return sorted;
  }, [filters, tasks]);

  useEffect(() => {
    void loadTasks();
    return subscribeToAuthChanges(() => {
      void loadTasks();
    });
  }, []);

  useEffect(() => {
    if (!taskForm.requesterId && users[0]) {
      setTaskForm((current) => ({
        ...current,
        requesterId: users[0].id,
        assigneeId: current.assigneeId || users[0].id
      }));
    }
  }, [taskForm.requesterId, users]);

  useEffect(() => {
    if (!taskForm.provinceId && provinces[0]) {
      setTaskForm((current) => ({ ...current, provinceId: provinces[0].id }));
    }
  }, [provinces, taskForm.provinceId]);

  useEffect(() => {
    const validZone = zonesForProvince.some((zone) => zone.id === taskForm.zoneId);
    if (!validZone) {
      setTaskForm((current) => ({ ...current, zoneId: zonesForProvince[0]?.id ?? "" }));
    }
  }, [taskForm.zoneId, zonesForProvince]);

  useEffect(() => {
    const validClient = clientsForZone.some((client) => client.id === taskForm.clientId);
    if (!validClient) {
      setTaskForm((current) => ({ ...current, clientId: clientsForZone[0]?.id ?? "" }));
    }
  }, [clientsForZone, taskForm.clientId]);

  useEffect(() => {
    const validPointOfSale = pointsOfSaleForScope.some((pointOfSale) => pointOfSale.id === taskForm.pointOfSaleId);
    if (!validPointOfSale) {
      setTaskForm((current) => ({ ...current, pointOfSaleId: pointsOfSaleForScope[0]?.id ?? "" }));
    }
  }, [pointsOfSaleForScope, taskForm.pointOfSaleId]);

  useEffect(() => {
    if (!taskForm.activityTypeId && activityTypes[0]) {
      setTaskForm((current) => ({ ...current, activityTypeId: activityTypes[0].id }));
    }

    if (!taskForm.taskTypeId && taskTypes[0]) {
      setTaskForm((current) => ({ ...current, taskTypeId: taskTypes[0].id }));
    }
  }, [activityTypes, taskForm.activityTypeId, taskForm.taskTypeId, taskTypes]);

  async function loadTasks() {
    try {
      setLoading(true);
      setError(null);

      const response = await authenticatedFetch(`${API_BASE_URL}/tasks/bootstrap`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Unable to load task data."));
      }

      const payload = (await response.json()) as TaskBootstrap;
      setBootstrap(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load task data.");
    } finally {
      setLoading(false);
    }
  }

  function resetTaskForm() {
    setEditingTaskId(null);
    setTaskForm((current) => ({
      ...DEFAULT_TASK_FORM,
      requesterId: current.requesterId || users[0]?.id || "",
      assigneeId: current.assigneeId || users[0]?.id || "",
      provinceId: provinces[0]?.id || "",
      zoneId: zones.filter((zone) => zone.provinceId === (provinces[0]?.id || ""))[0]?.id || "",
      clientId: clients[0]?.id || "",
      pointOfSaleId: pointsOfSale[0]?.id || "",
      activityTypeId: activityTypes[0]?.id || "",
      taskTypeId: taskTypes[0]?.id || ""
    }));
  }

  function beginEdit(task: Task) {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      requesterId: task.requesterId,
      assigneeId: task.assigneeId,
      scheduledFor: task.scheduledFor,
      provinceId: task.provinceId,
      zoneId: task.zoneId,
      clientId: task.clientId ?? "",
      pointOfSaleId: task.pointOfSaleId ?? "",
      activityTypeId: task.activityTypeId,
      taskTypeId: task.taskTypeId,
      priority: task.priority,
      difficulty: task.difficulty
    });
  }

  async function submitTask() {
    if (
      !taskForm.title.trim() ||
      !taskForm.requesterId ||
      !taskForm.assigneeId ||
      !taskForm.provinceId ||
      !taskForm.zoneId ||
      !taskForm.activityTypeId ||
      !taskForm.taskTypeId
    ) {
      return;
    }

    const payload: CreateTaskInput = {
      organizationId: ORGANIZATION_ID,
      title: taskForm.title.trim(),
      requesterId: taskForm.requesterId,
      assigneeId: taskForm.assigneeId,
      scheduledFor: taskForm.scheduledFor,
      provinceId: taskForm.provinceId,
      zoneId: taskForm.zoneId,
      clientId: taskForm.clientId || undefined,
      pointOfSaleId: taskForm.pointOfSaleId || undefined,
      activityTypeId: taskForm.activityTypeId,
      taskTypeId: taskForm.taskTypeId,
      priority: taskForm.priority,
      difficulty: taskForm.difficulty
    };

    try {
      setStatusMessage(null);
      setError(null);

      const response = await authenticatedFetch(
        editingTaskId ? `${API_BASE_URL}/tasks/${editingTaskId}` : `${API_BASE_URL}/tasks`,
        {
          method: editingTaskId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(
            editingTaskId
              ? ({
                  title: payload.title,
                  requesterId: payload.requesterId,
                  assigneeId: payload.assigneeId,
                  scheduledFor: payload.scheduledFor,
                  provinceId: payload.provinceId,
                  zoneId: payload.zoneId,
                  clientId: payload.clientId,
                  pointOfSaleId: payload.pointOfSaleId,
                  activityTypeId: payload.activityTypeId,
                  taskTypeId: payload.taskTypeId,
                  priority: payload.priority,
                  difficulty: payload.difficulty
                } satisfies UpdateTaskInput)
              : payload
          )
        }
      );

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Unable to save task."));
      }

      setStatusMessage(editingTaskId ? "Task updated successfully." : "Task created successfully.");
      resetTaskForm();
      startTransition(() => {
        void loadTasks();
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save task.");
    }
  }

  async function updateTaskStatus(taskId: string, status: TaskStatus) {
    try {
      setStatusMessage(null);
      setError(null);

      const response = await authenticatedFetch(`${API_BASE_URL}/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Unable to update task status."));
      }

      setStatusMessage(`Task status moved to ${status}.`);
      startTransition(() => {
        void loadTasks();
      });
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to update task status.");
    }
  }

  return (
    <section className="catalogSection" id="tasks">
      <div className="sectionHeading">
        <p className="eyebrow">{t("en", "tasks.title")}</p>
        <h2>{t("en", "tasks.sectionTitle")}</h2>
        <p className="sectionDescription">{t("en", "tasks.sectionDescription")}</p>
        <button className="secondaryAction sectionAction" disabled={actionDisabled} type="button" onClick={() => void loadTasks()}>
          {actionDisabled ? "Refreshing..." : t("en", "tasks.refresh")}
        </button>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">Loading task data...</p> : null}
        {isPending ? <p className="feedbackInfo">Refreshing from API...</p> : null}
        {statusMessage ? <p className="feedbackSuccess">{statusMessage}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
      </div>

      <div className="taskAdminLayout">
        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{editingTaskId ? "Edit task" : t("en", "tasks.add")}</h3>
              <p>Create task assignments using the same catalogs, scope, and workflow data already managed in Session 5.</p>
            </div>
          </div>

          <div className="formGrid">
            <label className="fullWidth">
              <span>Title</span>
              <input
                value={taskForm.title}
                onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Install launch display and capture before/after evidence"
              />
            </label>
            <label>
              <span>{t("en", "tasks.requester")}</span>
              <select
                value={taskForm.requesterId}
                onChange={(event) => setTaskForm((current) => ({ ...current, requesterId: event.target.value }))}
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("en", "tasks.assignee")}</span>
              <select
                value={taskForm.assigneeId}
                onChange={(event) => setTaskForm((current) => ({ ...current, assigneeId: event.target.value }))}
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("en", "tasks.scheduledFor")}</span>
              <input
                type="date"
                value={taskForm.scheduledFor}
                onChange={(event) => setTaskForm((current) => ({ ...current, scheduledFor: event.target.value }))}
              />
            </label>
            <label>
              <span>Province</span>
              <select
                value={taskForm.provinceId}
                onChange={(event) => setTaskForm((current) => ({ ...current, provinceId: event.target.value }))}
              >
                {provinces.map((province) => (
                  <option key={province.id} value={province.id}>
                    {province.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Zone</span>
              <select
                value={taskForm.zoneId}
                onChange={(event) => setTaskForm((current) => ({ ...current, zoneId: event.target.value }))}
              >
                {zonesForProvince.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("en", "tasks.client")}</span>
              <select
                value={taskForm.clientId}
                onChange={(event) => setTaskForm((current) => ({ ...current, clientId: event.target.value }))}
              >
                {clientsForZone.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("en", "tasks.pointOfSale")}</span>
              <select
                value={taskForm.pointOfSaleId}
                onChange={(event) => setTaskForm((current) => ({ ...current, pointOfSaleId: event.target.value }))}
              >
                {pointsOfSaleForScope.map((pointOfSale) => (
                  <option key={pointOfSale.id} value={pointOfSale.id}>
                    {pointOfSale.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("en", "tasks.activityType")}</span>
              <select
                value={taskForm.activityTypeId}
                onChange={(event) => setTaskForm((current) => ({ ...current, activityTypeId: event.target.value }))}
              >
                {activityTypes.map((activityType) => (
                  <option key={activityType.id} value={activityType.id}>
                    {activityType.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("en", "tasks.taskType")}</span>
              <select
                value={taskForm.taskTypeId}
                onChange={(event) => setTaskForm((current) => ({ ...current, taskTypeId: event.target.value }))}
              >
                {taskTypes.map((taskType) => (
                  <option key={taskType.id} value={taskType.id}>
                    {taskType.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("en", "tasks.priority")}</span>
              <select
                value={taskForm.priority}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, priority: event.target.value as Priority }))
                }
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {t("en", `priority.${priority}` as never)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("en", "tasks.difficulty")}</span>
              <select
                value={taskForm.difficulty}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, difficulty: event.target.value as Difficulty }))
                }
              >
                {DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {t("en", `difficulty.${difficulty}` as never)}
                  </option>
                ))}
              </select>
            </label>
            <div className="taskFormActions fullWidth">
              <button className="primaryAction" disabled={actionDisabled} type="button" onClick={submitTask}>
                {actionDisabled ? "Saving..." : editingTaskId ? "Save changes" : t("en", "tasks.add")}
              </button>
              {editingTaskId ? (
                <button className="secondaryAction" disabled={actionDisabled} type="button" onClick={resetTaskForm}>
                  Cancel edit
                </button>
              ) : null}
            </div>
          </div>
        </article>

        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>Active task list</h3>
              <p>Track assignment ownership, schedule, scope, and the allowed next status changes.</p>
            </div>
          </div>

          <div className="taskFilterBar">
            <label>
              <span>{t("en", "tasks.status")}</span>
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, status: event.target.value as TaskFilterState["status"] }))
                }
              >
                <option value="all">All statuses</option>
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t("en", `status.${status}` as never)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("en", "tasks.assignee")}</span>
              <select
                value={filters.assigneeId}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, assigneeId: event.target.value as TaskFilterState["assigneeId"] }))
                }
              >
                <option value="all">All assignees</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select
                value={filters.sortBy}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, sortBy: event.target.value as TaskFilterState["sortBy"] }))
                }
              >
                <option value="scheduledForAsc">Date ascending</option>
                <option value="scheduledForDesc">Date descending</option>
                <option value="priorityDesc">Priority</option>
                <option value="status">Status</option>
              </select>
            </label>
          </div>

          {visibleTasks.length > 0 ? (
            <div className="taskList">
              {visibleTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  users={users}
                  provinces={provinces}
                  zones={zones}
                  activityTypes={activityTypes}
                  taskTypes={taskTypes}
                  pointsOfSale={pointsOfSale}
                  actionDisabled={actionDisabled}
                  onEdit={beginEdit}
                  onStatusChange={updateTaskStatus}
                />
              ))}
            </div>
          ) : (
            <p className="catalogEmptyState">{t("en", "tasks.none")}</p>
          )}
        </article>
      </div>
    </section>
  );
}

function TaskCard({
  task,
  users,
  provinces,
  zones,
  activityTypes,
  taskTypes,
  pointsOfSale,
  actionDisabled,
  onEdit,
  onStatusChange
}: {
  task: Task;
  users: TaskBootstrap["users"];
  provinces: TaskBootstrap["provinces"];
  zones: TaskBootstrap["zones"];
  activityTypes: TaskBootstrap["activityTypes"];
  taskTypes: TaskBootstrap["taskTypes"];
  pointsOfSale: TaskBootstrap["pointsOfSale"];
  actionDisabled: boolean;
  onEdit: (task: Task) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => Promise<void>;
}) {
  const requester = users.find((user) => user.id === task.requesterId)?.name ?? task.requesterId;
  const assignee = users.find((user) => user.id === task.assigneeId)?.name ?? task.assigneeId;
  const province = provinces.find((item) => item.id === task.provinceId)?.name ?? task.provinceId;
  const zone = zones.find((item) => item.id === task.zoneId)?.name ?? task.zoneId;
  const pointOfSale = pointsOfSale.find((item) => item.id === task.pointOfSaleId)?.name;
  const activityType = activityTypes.find((item) => item.id === task.activityTypeId)?.name ?? task.activityTypeId;
  const taskType = taskTypes.find((item) => item.id === task.taskTypeId)?.name ?? task.taskTypeId;

  return (
    <article className="taskCard">
      <div className="taskCardHeader">
        <div>
          <h4>{task.title}</h4>
          <p>
            {t("en", "tasks.status")}: {t("en", `status.${task.status}` as never)}
          </p>
        </div>
        <span className="taskBadge">
          {t("en", `priority.${task.priority}` as never)} / {t("en", `difficulty.${task.difficulty}` as never)}
        </span>
      </div>

      <dl className="taskMetaGrid">
        <div>
          <dt>{t("en", "tasks.requester")}</dt>
          <dd>{requester}</dd>
        </div>
        <div>
          <dt>{t("en", "tasks.assignee")}</dt>
          <dd>{assignee}</dd>
        </div>
        <div>
          <dt>{t("en", "tasks.scheduledFor")}</dt>
          <dd>{task.scheduledFor}</dd>
        </div>
        <div>
          <dt>Route</dt>
          <dd>
            {province} / {zone}
          </dd>
        </div>
        <div>
          <dt>{t("en", "tasks.pointOfSale")}</dt>
          <dd>{pointOfSale ?? "Not linked"}</dd>
        </div>
        <div>
          <dt>Execution</dt>
          <dd>
            {taskType} / {activityType}
          </dd>
        </div>
      </dl>

      <div className="taskStatusActions">
        <button className="secondaryAction" disabled={actionDisabled} type="button" onClick={() => onEdit(task)}>
          Edit task
        </button>
        {STATUS_FLOW[task.status].map((nextStatus) => (
          <button
            key={nextStatus}
            className="secondaryAction"
            disabled={actionDisabled}
            type="button"
            onClick={() => void onStatusChange(task.id, nextStatus)}
          >
            Move to {t("en", `status.${nextStatus}` as never)}
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
