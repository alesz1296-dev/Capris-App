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
import { textByLocale, useAppLocale } from "./locale-client";

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
  const locale = useAppLocale();
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
    const loadFallback = textByLocale(locale, "Unable to load task data.", "No se pudieron cargar los datos de tareas.");
    try {
      setLoading(true);
      setError(null);

      const response = await authenticatedFetch(`${API_BASE_URL}/tasks/bootstrap`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, loadFallback));
      }

      const payload = (await response.json()) as TaskBootstrap;
      setBootstrap(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : loadFallback);
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
        throw new Error(await extractErrorMessage(response, textByLocale(locale, "Unable to save task.", "No se pudo guardar la tarea.")));
      }

      setStatusMessage(
        editingTaskId
          ? textByLocale(locale, "Task updated successfully.", "Tarea actualizada correctamente.")
          : textByLocale(locale, "Task created successfully.", "Tarea creada correctamente.")
      );
      resetTaskForm();
      startTransition(() => {
        void loadTasks();
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : textByLocale(locale, "Unable to save task.", "No se pudo guardar la tarea."));
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
        throw new Error(await extractErrorMessage(response, textByLocale(locale, "Unable to update task status.", "No se pudo actualizar el estado de la tarea.")));
      }

      setStatusMessage(textByLocale(locale, `Task status moved to ${status}.`, `Estado de tarea cambiado a ${status}.`));
      startTransition(() => {
        void loadTasks();
      });
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : textByLocale(locale, "Unable to update task status.", "No se pudo actualizar el estado de la tarea."));
    }
  }

  return (
    <section className="catalogSection" id="tasks">
      <div className="sectionHeading">
        <p className="eyebrow">{t(locale, "tasks.title")}</p>
        <h2>{t(locale, "tasks.sectionTitle")}</h2>
        <p className="sectionDescription">{t(locale, "tasks.sectionDescription")}</p>
        <button className="secondaryAction sectionAction" disabled={actionDisabled} type="button" onClick={() => void loadTasks()}>
          {actionDisabled ? textByLocale(locale, "Refreshing...", "Actualizando...") : t(locale, "tasks.refresh")}
        </button>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">{textByLocale(locale, "Loading task data...", "Cargando datos de tareas...")}</p> : null}
        {isPending ? <p className="feedbackInfo">{textByLocale(locale, "Refreshing from API...", "Actualizando desde la API...")}</p> : null}
        {statusMessage ? <p className="feedbackSuccess">{statusMessage}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
      </div>

      <div className="taskAdminLayout">
        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{editingTaskId ? textByLocale(locale, "Edit task", "Editar tarea") : t(locale, "tasks.add")}</h3>
              <p>{textByLocale(locale, "Create task assignments using the same catalogs, scope, and workflow data already managed in the admin workspace.", "Crea asignaciones de tareas usando los mismos catalogos, alcance y reglas de flujo ya administrados en el panel.")}</p>
            </div>
          </div>

          <div className="formGrid">
            <label className="fullWidth">
              <span>{textByLocale(locale, "Title", "Titulo")}</span>
              <input
                value={taskForm.title}
                onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                placeholder={textByLocale(locale, "Install launch display and capture before/after evidence", "Instalar material de lanzamiento y capturar evidencia antes y despues")}
              />
            </label>
            <label>
              <span>{t(locale, "tasks.requester")}</span>
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
              <span>{t(locale, "tasks.assignee")}</span>
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
              <span>{t(locale, "tasks.scheduledFor")}</span>
              <input
                type="date"
                value={taskForm.scheduledFor}
                onChange={(event) => setTaskForm((current) => ({ ...current, scheduledFor: event.target.value }))}
              />
            </label>
            <label>
              <span>{textByLocale(locale, "Province", "Provincia")}</span>
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
              <span>{textByLocale(locale, "Zone", "Zona")}</span>
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
              <span>{t(locale, "tasks.client")}</span>
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
              <span>{t(locale, "tasks.pointOfSale")}</span>
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
              <span>{t(locale, "tasks.activityType")}</span>
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
              <span>{t(locale, "tasks.taskType")}</span>
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
              <span>{t(locale, "tasks.priority")}</span>
              <select
                value={taskForm.priority}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, priority: event.target.value as Priority }))
                }
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {t(locale, `priority.${priority}` as never)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t(locale, "tasks.difficulty")}</span>
              <select
                value={taskForm.difficulty}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, difficulty: event.target.value as Difficulty }))
                }
              >
                {DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {t(locale, `difficulty.${difficulty}` as never)}
                  </option>
                ))}
              </select>
            </label>
            <div className="taskFormActions fullWidth">
              <button className="primaryAction" disabled={actionDisabled} type="button" onClick={submitTask}>
                {actionDisabled ? textByLocale(locale, "Saving...", "Guardando...") : editingTaskId ? textByLocale(locale, "Save changes", "Guardar cambios") : t(locale, "tasks.add")}
              </button>
              {editingTaskId ? (
                <button className="secondaryAction" disabled={actionDisabled} type="button" onClick={resetTaskForm}>
                  {textByLocale(locale, "Cancel edit", "Cancelar edicion")}
                </button>
              ) : null}
            </div>
          </div>
        </article>

        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{textByLocale(locale, "Active task list", "Lista activa de tareas")}</h3>
              <p>{textByLocale(locale, "Track assignment ownership, schedule, scope, and the allowed next status changes.", "Da seguimiento a responsables, calendario, alcance y los siguientes cambios de estado permitidos.")}</p>
            </div>
          </div>

          <div className="taskFilterBar">
            <label>
              <span>{t(locale, "tasks.status")}</span>
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, status: event.target.value as TaskFilterState["status"] }))
                }
              >
                <option value="all">{textByLocale(locale, "All statuses", "Todos los estados")}</option>
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(locale, `status.${status}` as never)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t(locale, "tasks.assignee")}</span>
              <select
                value={filters.assigneeId}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, assigneeId: event.target.value as TaskFilterState["assigneeId"] }))
                }
              >
                <option value="all">{textByLocale(locale, "All assignees", "Todos los responsables")}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{textByLocale(locale, "Sort", "Ordenar")}</span>
              <select
                value={filters.sortBy}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, sortBy: event.target.value as TaskFilterState["sortBy"] }))
                }
              >
                <option value="scheduledForAsc">{textByLocale(locale, "Date ascending", "Fecha ascendente")}</option>
                <option value="scheduledForDesc">{textByLocale(locale, "Date descending", "Fecha descendente")}</option>
                <option value="priorityDesc">{textByLocale(locale, "Priority", "Prioridad")}</option>
                <option value="status">{textByLocale(locale, "Status", "Estado")}</option>
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
            <p className="catalogEmptyState">{t(locale, "tasks.none")}</p>
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
  const locale = useAppLocale();
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
            {t(locale, "tasks.status")}: {t(locale, `status.${task.status}` as never)}
          </p>
        </div>
        <span className="taskBadge">
          {t(locale, `priority.${task.priority}` as never)} / {t(locale, `difficulty.${task.difficulty}` as never)}
        </span>
      </div>

      <dl className="taskMetaGrid">
        <div>
          <dt>{t(locale, "tasks.requester")}</dt>
          <dd>{requester}</dd>
        </div>
        <div>
          <dt>{t(locale, "tasks.assignee")}</dt>
          <dd>{assignee}</dd>
        </div>
        <div>
          <dt>{t(locale, "tasks.scheduledFor")}</dt>
          <dd>{task.scheduledFor}</dd>
        </div>
        <div>
          <dt>{textByLocale(locale, "Route", "Ruta")}</dt>
          <dd>
            {province} / {zone}
          </dd>
        </div>
        <div>
          <dt>{t(locale, "tasks.pointOfSale")}</dt>
          <dd>{pointOfSale ?? textByLocale(locale, "Not linked", "No vinculado")}</dd>
        </div>
        <div>
          <dt>{textByLocale(locale, "Execution", "Ejecucion")}</dt>
          <dd>
            {taskType} / {activityType}
          </dd>
        </div>
      </dl>

      <div className="taskStatusActions">
        <button className="secondaryAction" disabled={actionDisabled} type="button" onClick={() => onEdit(task)}>
          {textByLocale(locale, "Edit task", "Editar tarea")}
        </button>
        {STATUS_FLOW[task.status].map((nextStatus) => (
          <button
            key={nextStatus}
            className="secondaryAction"
            disabled={actionDisabled}
            type="button"
            onClick={() => void onStatusChange(task.id, nextStatus)}
          >
            {textByLocale(locale, "Move to", "Mover a")} {t(locale, `status.${nextStatus}` as never)}
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

