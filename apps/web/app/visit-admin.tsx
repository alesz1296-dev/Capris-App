"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { t, type Visit, type VisitBootstrap, type VisitStatus } from "@capris/shared";
import type { CreateVisitInput } from "@capris/shared";
import { API_BASE_URL, authenticatedFetch, subscribeToAuthChanges } from "./auth-client";
import { formatCoordinates, resolveWebCoordinates } from "./location-client";
import { textByLocale, useAppLocale } from "./locale-client";
import { ProvinceOperationsMap, type LiveLocation } from "./province-operations-map";

const ORGANIZATION_ID = "org_capris";

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
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const gpsWatchId = useRef<number | null>(null);
  const [bootstrap, setBootstrap] = useState<VisitBootstrap | null>(null);
  const [evidenceBootstrap, setEvidenceBootstrap] = useState<import("@capris/shared").EvidenceBootstrap | null>(null);
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
    return () => {
      if (gpsWatchId.current !== null && typeof navigator !== "undefined" && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(gpsWatchId.current);
      }
    };
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
    const loadFallback = textByLocale(locale, "Unable to load visit data.", "No se pudieron cargar los datos de visitas.");
    try {
      setLoading(true);
      setError(null);

      const [response, evidenceResponse] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/visits/bootstrap`, {
          cache: "no-store"
        }),
        authenticatedFetch(`${API_BASE_URL}/evidence/bootstrap`, {
          cache: "no-store"
        })
      ]);

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, loadFallback));
      }

      const payload = (await response.json()) as VisitBootstrap;
      if (evidenceResponse.ok) {
        setEvidenceBootstrap((await evidenceResponse.json()) as import("@capris/shared").EvidenceBootstrap);
      } else {
        setEvidenceBootstrap(null);
      }
      setBootstrap(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : loadFallback);
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
        throw new Error(await extractErrorMessage(response, textByLocale(locale, "Unable to create visit.", "No se pudo crear la visita.")));
      }

      setStatusMessage(textByLocale(locale, "Visit created successfully.", "Visita creada correctamente."));
      setVisitForm({
        taskId: selectedTask.id,
        scheduledFor: selectedTask.scheduledFor
      });
      startTransition(() => {
        void loadVisits();
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : textByLocale(locale, "Unable to create visit.", "No se pudo crear la visita."));
    }
  }

  async function transitionVisit(visit: Visit, action: "check_in" | "check_out") {
    const linkedPointOfSale = pointsOfSale.find((pointOfSale) => pointOfSale.id === visit.pointOfSaleId);
    const location = await resolveWebCoordinates(locale, linkedPointOfSale);
    const endpoint = action === "check_in" ? "check-in" : "check-out";
    const payload =
      action === "check_in"
        ? {
            checkedInAt: new Date().toISOString(),
            checkedInLatitude: location.latitude,
            checkedInLongitude: location.longitude
          }
        : {
            checkedOutAt: new Date().toISOString(),
            checkedOutLatitude: location.latitude,
            checkedOutLongitude: location.longitude
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
        throw new Error(
          await extractErrorMessage(
            response,
            action === "check_in"
              ? textByLocale(locale, "Unable to check in visit.", "No se pudo registrar la entrada de la visita.")
              : textByLocale(locale, "Unable to check out visit.", "No se pudo registrar la salida de la visita.")
          )
        );
      }

      setStatusMessage(
        action === "check_in"
          ? textByLocale(locale, `Visit ${visit.id} checked in.`, `Visita ${visit.id} registrada en entrada.`)
          : textByLocale(locale, `Visit ${visit.id} checked out.`, `Visita ${visit.id} registrada en salida.`)
      );
      startTransition(() => {
        void loadVisits();
      });
    } catch (transitionError) {
      setError(
        transitionError instanceof Error
          ? transitionError.message
          : action === "check_in"
            ? textByLocale(locale, "Unable to check in visit.", "No se pudo registrar la entrada de la visita.")
            : textByLocale(locale, "Unable to check out visit.", "No se pudo registrar la salida de la visita.")
      );
    }
  }

  function startLiveGps() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGpsStatus(textByLocale(locale, "This browser does not expose GPS.", "Este navegador no expone GPS."));
      return;
    }

    if (gpsWatchId.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchId.current);
    }

    setGpsStatus(textByLocale(locale, "Waiting for device GPS permission...", "Esperando permiso de GPS del dispositivo..."));
    gpsWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        setLiveLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          capturedAt: new Date().toISOString()
        });
        setGpsStatus(textByLocale(locale, "Live GPS active on this page.", "GPS en vivo activo en esta pagina."));
      },
      () => {
        setGpsStatus(textByLocale(locale, "GPS permission was denied or the device could not resolve a position.", "El permiso de GPS fue denegado o el dispositivo no pudo resolver una posicion."));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }
    );
  }

  function stopLiveGps() {
    if (gpsWatchId.current !== null && typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(gpsWatchId.current);
      gpsWatchId.current = null;
    }
    setGpsStatus(textByLocale(locale, "Live GPS stopped.", "GPS en vivo detenido."));
  }

  return (
    <section className="catalogSection" id="routes">
      <div className="sectionHeading">
        <p className="eyebrow">{t(locale, "visits.title")}</p>
        <h2>{t(locale, "visits.sectionTitle")}</h2>
        <p className="sectionDescription">{t(locale, "visits.sectionDescription")}</p>
        <button className="secondaryAction sectionAction" disabled={actionDisabled} type="button" onClick={() => void loadVisits()}>
          {actionDisabled ? textByLocale(locale, "Refreshing...", "Actualizando...") : textByLocale(locale, "Refresh route day", "Actualizar ruta del dia")}
        </button>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">{textByLocale(locale, "Loading visit data...", "Cargando datos de visitas...")}</p> : null}
        {isPending ? <p className="feedbackInfo">{textByLocale(locale, "Refreshing visit state from API...", "Actualizando estado de visitas desde la API...")}</p> : null}
        {statusMessage ? <p className="feedbackSuccess">{statusMessage}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
      </div>

      <ProvinceOperationsMap
        locale={locale}
        visitBootstrap={bootstrap}
        evidenceBootstrap={evidenceBootstrap}
        loading={loading}
        error={error}
        variant="routes"
        liveLocation={liveLocation}
      />

      <article className="liveGpsPanel">
        <div>
          <p className="eyebrow">{textByLocale(locale, "Device GPS", "GPS del dispositivo")}</p>
          <h3>{textByLocale(locale, "Live route tracking", "Seguimiento de ruta en vivo")}</h3>
          <p>
            {textByLocale(
              locale,
              "Runs only while this page is open. Check-in, check-out, and evidence still persist their own GPS captures.",
              "Funciona solo mientras esta pagina esta abierta. Entrada, salida y evidencia siguen guardando sus propias capturas GPS."
            )}
          </p>
        </div>
        <dl className="taskMetaGrid">
          <div>
            <dt>{textByLocale(locale, "Current coordinates", "Coordenadas actuales")}</dt>
            <dd>{liveLocation ? formatCoordinates(liveLocation.latitude, liveLocation.longitude) : "--"}</dd>
          </div>
          <div>
            <dt>{textByLocale(locale, "Accuracy", "Precision")}</dt>
            <dd>{liveLocation?.accuracyMeters ? `${Math.round(liveLocation.accuracyMeters)} m` : "--"}</dd>
          </div>
          <div>
            <dt>{textByLocale(locale, "Captured at", "Capturado en")}</dt>
            <dd>{liveLocation?.capturedAt ?? "--"}</dd>
          </div>
        </dl>
        <div className="taskCardActions">
          <button className="primaryAction" type="button" onClick={startLiveGps}>
            {textByLocale(locale, "Start live GPS", "Iniciar GPS en vivo")}
          </button>
          <button className="secondaryAction" type="button" onClick={stopLiveGps}>
            {textByLocale(locale, "Stop live GPS", "Detener GPS")}
          </button>
        </div>
        {gpsStatus ? <p className="feedbackInfo">{gpsStatus}</p> : null}
      </article>

      <div className="taskAdminLayout">
        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{textByLocale(locale, "Create task-linked visit", "Crear visita vinculada a tarea")}</h3>
              <p>{textByLocale(locale, "Visits inherit assignee and route scope from the selected task so route execution stays aligned with the task plan.", "Las visitas heredan responsable y alcance de ruta de la tarea seleccionada para que la ejecucion se mantenga alineada con el plan.")}</p>
            </div>
          </div>

          <div className="formGrid">
            <label className="fullWidth">
              <span>{textByLocale(locale, "Task", "Tarea")}</span>
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
              <span>{textByLocale(locale, "Province", "Provincia")}</span>
              <input
                disabled
                value={selectedTask ? provinces.find((province) => province.id === selectedTask.provinceId)?.name ?? selectedTask.provinceId : ""}
              />
            </label>
            <label>
              <span>{textByLocale(locale, "Zone", "Zona")}</span>
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
                {actionDisabled ? textByLocale(locale, "Saving...", "Guardando...") : textByLocale(locale, "Create visit", "Crear visita")}
              </button>
            </div>
          </div>
        </article>

        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{t(locale, "visits.routeDay")}</h3>
              <p>{textByLocale(locale, "Check in and check out route stops from the same visit list the field app will consume.", "Registra entrada y salida de paradas de ruta desde la misma lista de visitas que consumira la app de campo.")}</p>
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
  const linkedPointOfSale = pointsOfSale.find((item) => item.id === visit.pointOfSaleId);
  const pointOfSale = linkedPointOfSale?.name ?? textByLocale(locale, "Route stop not linked", "Parada de ruta no vinculada");

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
          <dt>{textByLocale(locale, "Route", "Ruta")}</dt>
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
          <dd>{visit.checkedInAt ?? textByLocale(locale, "Pending", "Pendiente")}</dd>
        </div>
        <div>
          <dt>{t(locale, "visits.checkedOutAt")}</dt>
          <dd>{visit.checkedOutAt ?? textByLocale(locale, "Pending", "Pendiente")}</dd>
        </div>
        <div>
          <dt>GPS</dt>
          <dd>
            {formatCoordinates(
              visit.checkedOutLatitude ?? visit.checkedInLatitude ?? linkedPointOfSale?.latitude,
              visit.checkedOutLongitude ?? visit.checkedInLongitude ?? linkedPointOfSale?.longitude
            )}
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
