"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  AgendaEvent,
  CalendarBootstrap,
  CalendarEntry,
  CalendarView,
  ClientRequest,
  ClientRequestBootstrap,
  ClientRequestStatus,
  CreateAgendaEventInput,
  CreateClientRequestInput
} from "@capris/shared";
import { API_BASE_URL, authenticatedFetch, subscribeToAuthChanges } from "./auth-client";
import { textByLocale, useAppLocale } from "./locale-client";

const ORGANIZATION_ID = "org_capris";
const DEFAULT_DATE = "2026-05-08";

const CALENDAR_VIEWS: CalendarView[] = ["day", "week", "month", "year"];
const REQUEST_STATUSES: ClientRequestStatus[] = ["open", "in_progress", "waiting_client", "resolved", "closed"];

function calendarViewLabel(locale: "en" | "es", view: CalendarView) {
  return textByLocale(
    locale,
    view,
    {
      day: "dia",
      week: "semana",
      month: "mes",
      year: "anio"
    }[view]
  );
}

function calendarEntryKindLabel(locale: "en" | "es", kind: CalendarEntry["kind"]) {
  return textByLocale(
    locale,
    kind.replaceAll("_", " "),
    {
      agenda_event: "evento de agenda",
      task: "tarea",
      visit: "visita",
      client_request: "solicitud de cliente"
    }[kind]
  );
}

function clientRequestStatusLabel(locale: "en" | "es", status: ClientRequestStatus) {
  return textByLocale(
    locale,
    status.replaceAll("_", " "),
    {
      open: "abierta",
      in_progress: "en proceso",
      waiting_client: "esperando al cliente",
      resolved: "resuelta",
      closed: "cerrada"
    }[status]
  );
}

function priorityLabel(locale: "en" | "es", priority: ClientRequestFormState["priority"]) {
  return textByLocale(
    locale,
    priority,
    {
      low: "baja",
      medium: "media",
      high: "alta",
      urgent: "urgente"
    }[priority]
  );
}

type AgendaFormState = {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  scopeType: "organization" | "team" | "user";
  scopeReferenceId: string;
  ownerUserId: string;
  teamId: string;
  colorToken: string;
  createdByUserId: string;
};

type ClientRequestFormState = {
  title: string;
  description: string;
  requesterName: string;
  requesterEmail: string;
  ownerUserId: string;
  clientId: string;
  provinceId: string;
  zoneId: string;
  pointOfSaleId: string;
  taskId: string;
  dueDate: string;
  priority: "low" | "medium" | "high" | "urgent";
};

const EMPTY_AGENDA_FORM: AgendaFormState = {
  title: "",
  description: "",
  startAt: "2026-05-08T14:00:00.000Z",
  endAt: "2026-05-08T15:00:00.000Z",
  allDay: false,
  scopeType: "organization",
  scopeReferenceId: "",
  ownerUserId: "",
  teamId: "",
  colorToken: "agenda",
  createdByUserId: "user_supervisor_001"
};

const EMPTY_REQUEST_FORM: ClientRequestFormState = {
  title: "",
  description: "",
  requesterName: "",
  requesterEmail: "",
  ownerUserId: "user_supervisor_001",
  clientId: "",
  provinceId: "",
  zoneId: "",
  pointOfSaleId: "",
  taskId: "",
  dueDate: "2026-05-12",
  priority: "medium"
};

export function AgendaAdmin() {
  const locale = useAppLocale();
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("week");
  const [anchorDate, setAnchorDate] = useState(DEFAULT_DATE);
  const [calendar, setCalendar] = useState<CalendarBootstrap | null>(null);
  const [requestBootstrap, setRequestBootstrap] = useState<ClientRequestBootstrap | null>(null);
  const [agendaForm, setAgendaForm] = useState<AgendaFormState>(EMPTY_AGENDA_FORM);
  const [requestForm, setRequestForm] = useState<ClientRequestFormState>(EMPTY_REQUEST_FORM);

  useEffect(() => {
    void loadAgendaData();
    return subscribeToAuthChanges(() => {
      void loadAgendaData();
    });
  }, [view, anchorDate]);

  useEffect(() => {
    if (!requestBootstrap?.users.length) {
      return;
    }

    setAgendaForm((current) => ({
      ...current,
      ownerUserId: current.ownerUserId || requestBootstrap.users[0].id,
      createdByUserId: current.createdByUserId || requestBootstrap.users[0].id
    }));
    setRequestForm((current) => ({
      ...current,
      ownerUserId: current.ownerUserId || requestBootstrap.users[0].id
    }));
  }, [requestBootstrap]);

  const entries = calendar?.entries ?? [];
  const agendaEvents = calendar?.agendaEvents ?? [];
  const requests = requestBootstrap?.requests ?? [];
  const users = requestBootstrap?.users ?? [];
  const teams = calendar?.teams ?? [];
  const clients = requestBootstrap?.clients ?? [];
  const provinces = requestBootstrap?.provinces ?? [];
  const zones = requestBootstrap?.zones ?? [];
  const pointsOfSale = requestBootstrap?.pointsOfSale ?? [];
  const tasks = requestBootstrap?.tasks ?? [];

  const groupedCounts = useMemo(
    () => ({
      agenda: entries.filter((entry) => entry.kind === "agenda_event").length,
      tasks: entries.filter((entry) => entry.kind === "task").length,
      visits: entries.filter((entry) => entry.kind === "visit").length,
      requests: entries.filter((entry) => entry.kind === "client_request").length
    }),
    [entries]
  );

  async function loadAgendaData() {
    const calendarFallback = textByLocale(locale, "Unable to load calendar data.", "No se pudieron cargar los datos del calendario.");
    const requestFallback = textByLocale(locale, "Unable to load client requests.", "No se pudieron cargar las solicitudes de cliente.");
    const sessionFallback = textByLocale(locale, "Unable to load agenda data.", "No se pudieron cargar los datos de agenda.");
    try {
      setLoading(true);
      setError(null);

      const [calendarResponse, requestsResponse] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/calendar/bootstrap?view=${view}&date=${anchorDate}`, { cache: "no-store" }),
        authenticatedFetch(`${API_BASE_URL}/client-requests/bootstrap`, { cache: "no-store" })
      ]);

      if (!calendarResponse.ok) {
        throw new Error(await extractErrorMessage(calendarResponse, calendarFallback));
      }
      if (!requestsResponse.ok) {
        throw new Error(await extractErrorMessage(requestsResponse, requestFallback));
      }

      const [calendarPayload, requestsPayload] = await Promise.all([
        calendarResponse.json() as Promise<CalendarBootstrap>,
        requestsResponse.json() as Promise<ClientRequestBootstrap>
      ]);

      setCalendar(calendarPayload);
      setRequestBootstrap(requestsPayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : sessionFallback);
    } finally {
      setLoading(false);
    }
  }

  async function createAgendaEvent() {
    const payload: CreateAgendaEventInput = {
      organizationId: ORGANIZATION_ID,
      title: agendaForm.title,
      description: agendaForm.description || undefined,
      startAt: agendaForm.startAt,
      endAt: agendaForm.endAt,
      allDay: agendaForm.allDay,
      scopeType: agendaForm.scopeType,
      scopeReferenceId: agendaForm.scopeReferenceId || undefined,
      ownerUserId: agendaForm.ownerUserId || undefined,
      teamId: agendaForm.teamId || undefined,
      colorToken: agendaForm.colorToken || undefined,
      createdByUserId: agendaForm.createdByUserId
    };

    await submit(`${API_BASE_URL}/calendar/agenda-events`, payload, textByLocale(locale, "Shared agenda event created.", "Evento compartido de agenda creado."));
    setAgendaForm((current) => ({ ...EMPTY_AGENDA_FORM, createdByUserId: current.createdByUserId, ownerUserId: current.ownerUserId }));
  }

  async function createClientRequest() {
    const payload: CreateClientRequestInput = {
      organizationId: ORGANIZATION_ID,
      title: requestForm.title,
      description: requestForm.description || undefined,
      requesterName: requestForm.requesterName,
      requesterEmail: requestForm.requesterEmail || undefined,
      ownerUserId: requestForm.ownerUserId,
      clientId: requestForm.clientId || undefined,
      provinceId: requestForm.provinceId || undefined,
      zoneId: requestForm.zoneId || undefined,
      pointOfSaleId: requestForm.pointOfSaleId || undefined,
      taskId: requestForm.taskId || undefined,
      dueDate: requestForm.dueDate,
      openedAt: new Date().toISOString(),
      priority: requestForm.priority
    };

    await submit(`${API_BASE_URL}/client-requests`, payload, textByLocale(locale, "Client request created.", "Solicitud de cliente creada."));
    setRequestForm((current) => ({ ...EMPTY_REQUEST_FORM, ownerUserId: current.ownerUserId }));
  }

  async function updateRequestStatus(request: ClientRequest, status: ClientRequestStatus) {
    await submit(
      `${API_BASE_URL}/client-requests/${request.id}/status`,
      {
        status,
        resolvedAt: status === "resolved" ? new Date().toISOString() : undefined,
        closedAt: status === "closed" ? new Date().toISOString() : undefined
      },
      textByLocale(locale, `Client request moved to ${status}.`, `Solicitud de cliente movida a ${clientRequestStatusLabel(locale, status)}.`),
      "PATCH"
    );
  }

  async function submit(url: string, payload: unknown, successMessage: string, method: "POST" | "PATCH" = "POST") {
    const saveFallback = textByLocale(locale, "Unable to save agenda data.", "No se pudieron guardar los datos de agenda.");
    try {
      setStatusMessage(null);
      setError(null);

      const response = await authenticatedFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, saveFallback));
      }

      setStatusMessage(successMessage);
      startTransition(() => {
        void loadAgendaData();
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : saveFallback);
    }
  }

  return (
    <section className="catalogSection" id="agenda">
      <div className="sectionHeading">
        <h2>{textByLocale(locale, "Shared agenda, calendars, and client requests", "Agenda compartida, calendarios y solicitudes de cliente")}</h2>
        <p className="sectionDescription">
          {textByLocale(locale, "View daily, weekly, monthly, and yearly scheduling windows, create shared team agenda events, and follow client requests with ownership, due dates, and aging.", "Consulta ventanas de programacion diarias, semanales, mensuales y anuales, crea eventos compartidos de equipo y da seguimiento a solicitudes de cliente con responsables, vencimientos y antiguedad.")}
        </p>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">{textByLocale(locale, "Loading calendar and client-request data...", "Cargando calendario y solicitudes de cliente...")}</p> : null}
        {isPending ? <p className="feedbackInfo">{textByLocale(locale, "Refreshing agenda state from API...", "Actualizando estado de agenda desde la API...")}</p> : null}
        {statusMessage ? <p className="feedbackSuccess">{statusMessage}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
      </div>

      <div className="metrics">
        <article className="metric">
          <span>{textByLocale(locale, "Agenda events", "Eventos de agenda")}</span>
          <strong>{groupedCounts.agenda}</strong>
        </article>
        <article className="metric">
          <span>{textByLocale(locale, "Scheduled tasks", "Tareas programadas")}</span>
          <strong>{groupedCounts.tasks}</strong>
        </article>
        <article className="metric">
          <span>{textByLocale(locale, "Scheduled visits", "Visitas programadas")}</span>
          <strong>{groupedCounts.visits}</strong>
        </article>
        <article className="metric">
          <span>{textByLocale(locale, "Requests due in view", "Solicitudes que vencen en la vista")}</span>
          <strong>{groupedCounts.requests}</strong>
        </article>
      </div>

      <div className="taskAdminLayout">
        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{textByLocale(locale, "Calendar views", "Vistas del calendario")}</h3>
              <p>
                {calendar?.window.startDate ?? anchorDate} {textByLocale(locale, "to", "a")} {calendar?.window.endDate ?? anchorDate}
              </p>
            </div>
          </div>
          <div className="taskStatusActions">
            {CALENDAR_VIEWS.map((calendarView) => (
              <button
                key={calendarView}
                className={calendarView === view ? "primaryAction" : "secondaryAction"}
                type="button"
                onClick={() => setView(calendarView)}
              >
                {calendarViewLabel(locale, calendarView)}
              </button>
            ))}
          </div>
          <label className="fullWidth">
            <span>{textByLocale(locale, "Anchor date", "Fecha de referencia")}</span>
            <input type="date" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} />
          </label>
          <div className="taskList">
            {entries.map((entry: CalendarEntry) => (
              <article className="taskCard" key={entry.id}>
                <div className="taskCardHeader">
                  <div>
                    <h4>{entry.title}</h4>
                    <p>
                      {calendarEntryKindLabel(locale, entry.kind)} / {entry.startAt}
                    </p>
                  </div>
                  <span className="taskBadge">{entry.status ? clientRequestStatusLabel(locale, entry.status as ClientRequestStatus) : calendarEntryKindLabel(locale, entry.kind)}</span>
                </div>
                {entry.description ? <p>{entry.description}</p> : null}
              </article>
            ))}
          </div>
        </article>

        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{textByLocale(locale, "Create agenda event", "Crear evento de agenda")}</h3>
              <p>{textByLocale(locale, "Use shared events for team meetings, special activations, holiday blockers, and supervisor follow-up windows.", "Usa eventos compartidos para reuniones de equipo, activaciones especiales, bloqueos por feriados y ventanas de seguimiento de supervision.")}</p>
            </div>
          </div>
          <div className="formGrid">
            <label className="fullWidth">
              <span>{textByLocale(locale, "Title", "Titulo")}</span>
              <input value={agendaForm.title} onChange={(event) => setAgendaForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="fullWidth">
              <span>{textByLocale(locale, "Description", "Descripcion")}</span>
              <textarea value={agendaForm.description} onChange={(event) => setAgendaForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label>
              <span>{textByLocale(locale, "Start", "Inicio")}</span>
              <input value={agendaForm.startAt} onChange={(event) => setAgendaForm((current) => ({ ...current, startAt: event.target.value }))} />
            </label>
            <label>
              <span>{textByLocale(locale, "End", "Fin")}</span>
              <input value={agendaForm.endAt} onChange={(event) => setAgendaForm((current) => ({ ...current, endAt: event.target.value }))} />
            </label>
            <label>
              <span>{textByLocale(locale, "Scope", "Alcance")}</span>
              <select value={agendaForm.scopeType} onChange={(event) => setAgendaForm((current) => ({ ...current, scopeType: event.target.value as AgendaFormState["scopeType"] }))}>
                <option value="organization">{textByLocale(locale, "organization", "organizacion")}</option>
                <option value="team">{textByLocale(locale, "team", "equipo")}</option>
                <option value="user">{textByLocale(locale, "user", "usuario")}</option>
              </select>
            </label>
            <label>
              <span>{textByLocale(locale, "Scope reference", "Referencia de alcance")}</span>
              <input value={agendaForm.scopeReferenceId} onChange={(event) => setAgendaForm((current) => ({ ...current, scopeReferenceId: event.target.value }))} />
            </label>
            <label>
              <span>{textByLocale(locale, "Owner", "Responsable")}</span>
              <select value={agendaForm.ownerUserId} onChange={(event) => setAgendaForm((current) => ({ ...current, ownerUserId: event.target.value }))}>
                <option value="">{textByLocale(locale, "No owner", "Sin responsable")}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{textByLocale(locale, "Team", "Equipo")}</span>
              <select value={agendaForm.teamId} onChange={(event) => setAgendaForm((current) => ({ ...current, teamId: event.target.value }))}>
                <option value="">{textByLocale(locale, "No team", "Sin equipo")}</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{textByLocale(locale, "Color token", "Color de agenda")}</span>
              <input value={agendaForm.colorToken} onChange={(event) => setAgendaForm((current) => ({ ...current, colorToken: event.target.value }))} />
            </label>
          </div>
          <div className="taskFormActions">
            <button className="primaryAction" disabled={loading || isPending} type="button" onClick={() => void createAgendaEvent()}>
              {textByLocale(locale, "Create agenda event", "Crear evento de agenda")}
            </button>
          </div>
          <div className="taskList">
            {agendaEvents.map((item: AgendaEvent) => (
              <article className="taskCard" key={item.id}>
                <div className="taskCardHeader">
                  <div>
                  <h4>{item.title}</h4>
                  <p>
                    {item.startAt} {textByLocale(locale, "to", "a")} {item.endAt}
                  </p>
                </div>
                <span className="taskBadge">{textByLocale(locale, item.scopeType, item.scopeType === "organization" ? "organizacion" : item.scopeType === "team" ? "equipo" : "usuario")}</span>
                </div>
                {item.description ? <p>{item.description}</p> : null}
              </article>
            ))}
          </div>
        </article>
      </div>

      <article className="catalogManagerCard" id="requests">
        <div className="catalogManagerHeader">
          <div>
            <h3>{textByLocale(locale, "Client request follow-up", "Seguimiento de solicitudes de cliente")}</h3>
            <p>{textByLocale(locale, "Track requester expectations, ownership, aging, and overdue risk from one supervisor/admin view.", "Da seguimiento a expectativas del solicitante, responsables, antiguedad y riesgo de vencimiento desde una sola vista de supervision.")}</p>
          </div>
        </div>
        <div className="formGrid">
          <label className="fullWidth">
            <span>{textByLocale(locale, "Title", "Titulo")}</span>
            <input value={requestForm.title} onChange={(event) => setRequestForm((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label className="fullWidth">
            <span>{textByLocale(locale, "Description", "Descripcion")}</span>
            <textarea value={requestForm.description} onChange={(event) => setRequestForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label>
            <span>{textByLocale(locale, "Requester", "Solicitante")}</span>
            <input value={requestForm.requesterName} onChange={(event) => setRequestForm((current) => ({ ...current, requesterName: event.target.value }))} />
          </label>
          <label>
            <span>{textByLocale(locale, "Requester email", "Correo del solicitante")}</span>
            <input value={requestForm.requesterEmail} onChange={(event) => setRequestForm((current) => ({ ...current, requesterEmail: event.target.value }))} />
          </label>
          <label>
            <span>{textByLocale(locale, "Owner", "Responsable")}</span>
            <select value={requestForm.ownerUserId} onChange={(event) => setRequestForm((current) => ({ ...current, ownerUserId: event.target.value }))}>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{textByLocale(locale, "Due date", "Fecha limite")}</span>
            <input type="date" value={requestForm.dueDate} onChange={(event) => setRequestForm((current) => ({ ...current, dueDate: event.target.value }))} />
          </label>
          <label>
            <span>{textByLocale(locale, "Priority", "Prioridad")}</span>
            <select value={requestForm.priority} onChange={(event) => setRequestForm((current) => ({ ...current, priority: event.target.value as ClientRequestFormState["priority"] }))}>
              <option value="low">{textByLocale(locale, "low", "baja")}</option>
              <option value="medium">{textByLocale(locale, "medium", "media")}</option>
              <option value="high">{textByLocale(locale, "high", "alta")}</option>
              <option value="urgent">{textByLocale(locale, "urgent", "urgente")}</option>
            </select>
          </label>
          <label>
            <span>{textByLocale(locale, "Client", "Cliente")}</span>
            <select value={requestForm.clientId} onChange={(event) => setRequestForm((current) => ({ ...current, clientId: event.target.value }))}>
              <option value="">{textByLocale(locale, "No client", "Sin cliente")}</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{textByLocale(locale, "Province", "Provincia")}</span>
            <select value={requestForm.provinceId} onChange={(event) => setRequestForm((current) => ({ ...current, provinceId: event.target.value }))}>
              <option value="">{textByLocale(locale, "No province", "Sin provincia")}</option>
              {provinces.map((province) => (
                <option key={province.id} value={province.id}>
                  {province.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{textByLocale(locale, "Zone", "Zona")}</span>
            <select value={requestForm.zoneId} onChange={(event) => setRequestForm((current) => ({ ...current, zoneId: event.target.value }))}>
              <option value="">{textByLocale(locale, "No zone", "Sin zona")}</option>
              {zones
                .filter((zone) => !requestForm.provinceId || zone.provinceId === requestForm.provinceId)
                .map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>{textByLocale(locale, "Point of sale", "Punto de venta")}</span>
            <select value={requestForm.pointOfSaleId} onChange={(event) => setRequestForm((current) => ({ ...current, pointOfSaleId: event.target.value }))}>
              <option value="">{textByLocale(locale, "No POS", "Sin PDV")}</option>
              {pointsOfSale
                .filter((pointOfSale) => (!requestForm.clientId || pointOfSale.clientId === requestForm.clientId) && (!requestForm.zoneId || pointOfSale.zoneId === requestForm.zoneId))
                .map((pointOfSale) => (
                  <option key={pointOfSale.id} value={pointOfSale.id}>
                    {pointOfSale.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="fullWidth">
            <span>{textByLocale(locale, "Linked task", "Tarea vinculada")}</span>
            <select value={requestForm.taskId} onChange={(event) => setRequestForm((current) => ({ ...current, taskId: event.target.value }))}>
              <option value="">{textByLocale(locale, "No task", "Sin tarea")}</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="taskFormActions">
          <button className="primaryAction" disabled={loading || isPending} type="button" onClick={() => void createClientRequest()}>
            {textByLocale(locale, "Create client request", "Crear solicitud de cliente")}
          </button>
        </div>
        <div className="taskList">
          {requests.map((request) => (
            <article className="taskCard" key={request.id}>
              <div className="taskCardHeader">
                <div>
                  <h4>{request.title}</h4>
                  <p>
                    {request.requesterName} / {textByLocale(locale, "due", "vence")} {request.dueDate}
                  </p>
                </div>
                <span className="taskBadge">{clientRequestStatusLabel(locale, request.status)}</span>
              </div>
              {request.description ? <p>{request.description}</p> : null}
              <p>
                {textByLocale(locale, "Age", "Antiguedad")} {request.agingDays} {textByLocale(locale, "days", "dias")} {request.overdue ? `/ ${textByLocale(locale, "overdue", "vencida")}` : ""}
              </p>
              <p>
                {textByLocale(locale, "Owner", "Responsable")}: {users.find((user) => user.id === request.ownerUserId)?.name ?? request.ownerUserId} / {textByLocale(locale, "Priority", "Prioridad")}: {priorityLabel(locale, request.priority)}
              </p>
              <div className="taskStatusActions">
                {REQUEST_STATUSES.filter((status) => status !== request.status).map((status) => (
                  <button key={status} className="secondaryAction" type="button" onClick={() => void updateRequestStatus(request, status)}>
                    {clientRequestStatusLabel(locale, status)}
                  </button>
                ))}
              </div>
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
