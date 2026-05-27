"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { AuthProfileResponse, Consignation, TaskBootstrap } from "@capris/shared";
import { API_BASE_URL, authenticatedFetch, subscribeToAuthChanges } from "./auth-client";
import { textByLocale, useAppLocale } from "./locale-client";

const ORGANIZATION_ID = "org_capris";

type PointOfSaleFormState = {
  name: string;
  provinceId: string;
  zoneId: string;
  clientId: string;
  address: string;
};

type ConsignationFormState = {
  taskId: string;
  note: string;
};

const EMPTY_POINT_OF_SALE_FORM: PointOfSaleFormState = {
  name: "",
  provinceId: "",
  zoneId: "",
  clientId: "",
  address: ""
};

const EMPTY_CONSIGNATION_FORM: ConsignationFormState = {
  taskId: "",
  note: ""
};

export function SupervisorRouteWorkspace() {
  const locale = useAppLocale();
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<AuthProfileResponse | null>(null);
  const [bootstrap, setBootstrap] = useState<TaskBootstrap | null>(null);
  const [consignations, setConsignations] = useState<Consignation[]>([]);
  const [pointOfSaleForm, setPointOfSaleForm] = useState<PointOfSaleFormState>(EMPTY_POINT_OF_SALE_FORM);
  const [consignationForm, setConsignationForm] = useState<ConsignationFormState>(EMPTY_CONSIGNATION_FORM);

  const isSupervisorSurface = profile?.user.role === "admin" || profile?.user.role === "supervisor";
  const provinces = bootstrap?.provinces.filter((province) => province.active) ?? [];
  const zones = bootstrap?.zones.filter((zone) => zone.active) ?? [];
  const clients = bootstrap?.clients.filter((client) => client.active) ?? [];
  const tasks = bootstrap?.tasks ?? [];
  const pointsOfSale = bootstrap?.pointsOfSale.filter((pointOfSale) => pointOfSale.active) ?? [];

  const zonesForProvince = useMemo(
    () => zones.filter((zone) => zone.provinceId === pointOfSaleForm.provinceId),
    [pointOfSaleForm.provinceId, zones]
  );

  useEffect(() => {
    void loadSupervisorData();
    return subscribeToAuthChanges(() => {
      void loadSupervisorData();
    });
  }, []);

  useEffect(() => {
    if (!pointOfSaleForm.provinceId && provinces[0]) {
      setPointOfSaleForm((current) => ({ ...current, provinceId: provinces[0].id }));
    }
  }, [pointOfSaleForm.provinceId, provinces]);

  useEffect(() => {
    if (!pointOfSaleForm.zoneId || !zonesForProvince.some((zone) => zone.id === pointOfSaleForm.zoneId)) {
      setPointOfSaleForm((current) => ({ ...current, zoneId: zonesForProvince[0]?.id ?? "" }));
    }
  }, [pointOfSaleForm.zoneId, zonesForProvince]);

  useEffect(() => {
    if (!pointOfSaleForm.clientId && clients[0]) {
      setPointOfSaleForm((current) => ({ ...current, clientId: clients[0].id }));
    }
  }, [clients, pointOfSaleForm.clientId]);

  useEffect(() => {
    if (!consignationForm.taskId && tasks[0]) {
      setConsignationForm((current) => ({ ...current, taskId: tasks[0].id }));
    }
  }, [consignationForm.taskId, tasks]);

  async function loadSupervisorData() {
    const fallback = textByLocale(
      locale,
      "Unable to load supervisor route workspace.",
      "No se pudo cargar el espacio de supervision de rutas."
    );

    try {
      setLoading(true);
      setError(null);

      const [profileResponse, tasksResponse, consignationsResponse] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/auth/me`, { cache: "no-store" }),
        authenticatedFetch(`${API_BASE_URL}/tasks/bootstrap`, { cache: "no-store" }),
        authenticatedFetch(`${API_BASE_URL}/consignations`, { cache: "no-store" })
      ]);

      if (!profileResponse.ok) {
        throw new Error(await extractErrorMessage(profileResponse, fallback));
      }
      if (!tasksResponse.ok) {
        throw new Error(await extractErrorMessage(tasksResponse, fallback));
      }
      if (!consignationsResponse.ok) {
        throw new Error(await extractErrorMessage(consignationsResponse, fallback));
      }

      const [profilePayload, tasksPayload, consignationsPayload] = await Promise.all([
        profileResponse.json() as Promise<AuthProfileResponse>,
        tasksResponse.json() as Promise<TaskBootstrap>,
        consignationsResponse.json() as Promise<Consignation[]>
      ]);

      setProfile(profilePayload);
      setBootstrap(tasksPayload);
      setConsignations(consignationsPayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : fallback);
    } finally {
      setLoading(false);
    }
  }

  async function createPointOfSale() {
    const code = buildPointOfSaleCode(pointOfSaleForm.name, pointOfSaleForm.zoneId);

    try {
      setError(null);
      setStatusMessage(null);

      const response = await authenticatedFetch(`${API_BASE_URL}/catalogs/points-of-sale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: ORGANIZATION_ID,
          provinceId: pointOfSaleForm.provinceId,
          zoneId: pointOfSaleForm.zoneId,
          clientId: pointOfSaleForm.clientId,
          name: pointOfSaleForm.name,
          code,
          address: pointOfSaleForm.address || undefined
        })
      });

      if (!response.ok) {
        throw new Error(
          await extractErrorMessage(
            response,
            textByLocale(locale, "Unable to add route stop.", "No se pudo agregar la parada de ruta.")
          )
        );
      }

      setStatusMessage(
        textByLocale(
          locale,
          "Route stop saved and shared with the team.",
          "Parada de ruta guardada y compartida con el equipo."
        )
      );
      setPointOfSaleForm((current) => ({
        ...EMPTY_POINT_OF_SALE_FORM,
        provinceId: current.provinceId,
        zoneId: current.zoneId,
        clientId: current.clientId
      }));
      startTransition(() => {
        void loadSupervisorData();
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : textByLocale(locale, "Unable to add route stop.", "No se pudo agregar la parada de ruta.")
      );
    }
  }

  async function prepareConsignation() {
    const payload = {
      organizationId: ORGANIZATION_ID,
      taskId: consignationForm.taskId,
      note: consignationForm.note || undefined,
      preparedAt: new Date().toISOString()
    };

    try {
      setError(null);
      setStatusMessage(null);

      const response = await authenticatedFetch(`${API_BASE_URL}/consignations/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(
          await extractErrorMessage(
            response,
            textByLocale(locale, "Unable to prepare consignation.", "No se pudo preparar la consignacion.")
          )
        );
      }

      setStatusMessage(
        textByLocale(locale, "Consignation prepared.", "Consignacion preparada.")
      );
      setConsignationForm((current) => ({ ...current, note: "" }));
      startTransition(() => {
        void loadSupervisorData();
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : textByLocale(locale, "Unable to prepare consignation.", "No se pudo preparar la consignacion.")
      );
    }
  }

  if (!isSupervisorSurface && !loading) {
    return null;
  }

  return (
    <section className="catalogSection routeSupervisorSection">
      <div className="sectionHeading">
        <p className="eyebrow">{textByLocale(locale, "Supervisor planning", "Planeacion de supervision")}</p>
        <h2>{textByLocale(locale, "Supervisor route planning workspace", "Espacio de planeacion de rutas para supervision")}</h2>
        <p className="sectionDescription">
          {textByLocale(
            locale,
            "Supervisors can add shared route stops and prepare consignations here, while task assignment and agenda planning stay on their own dedicated pages.",
            "Los supervisores pueden agregar paradas compartidas y preparar consignaciones aqui, mientras la asignacion de tareas y la agenda quedan en sus propias paginas."
          )}
        </p>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">{textByLocale(locale, "Loading supervisor tools...", "Cargando herramientas de supervision...")}</p> : null}
        {isPending ? <p className="feedbackInfo">{textByLocale(locale, "Refreshing shared route planning data...", "Actualizando datos compartidos de planeacion...")}</p> : null}
        {statusMessage ? <p className="feedbackSuccess">{statusMessage}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
      </div>

      <div className="taskAdminLayout">
        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{textByLocale(locale, "Add route stop", "Agregar parada de ruta")}</h3>
              <p>
                {textByLocale(
                  locale,
                  "Create a shared store or selling point by zone so the stop persists after refresh and becomes available to everyone.",
                  "Crea una tienda o punto de venta compartido por zona para que persista despues del refresco y quede disponible para todos."
                )}
              </p>
            </div>
          </div>

          <div className="formGrid">
            <label className="fullWidth">
              <span>{textByLocale(locale, "Store name", "Nombre de tienda")}</span>
              <input
                value={pointOfSaleForm.name}
                onChange={(event) => setPointOfSaleForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              <span>{textByLocale(locale, "Province", "Provincia")}</span>
              <select
                value={pointOfSaleForm.provinceId}
                onChange={(event) => setPointOfSaleForm((current) => ({ ...current, provinceId: event.target.value }))}
              >
                {provinces.map((province) => (
                  <option key={province.id} value={province.id}>
                    {province.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{textByLocale(locale, "City / place", "Ciudad / lugar")}</span>
              <select
                value={pointOfSaleForm.zoneId}
                onChange={(event) => setPointOfSaleForm((current) => ({ ...current, zoneId: event.target.value }))}
              >
                {zonesForProvince.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{textByLocale(locale, "Client / chain", "Cliente / cadena")}</span>
              <select
                value={pointOfSaleForm.clientId}
                onChange={(event) => setPointOfSaleForm((current) => ({ ...current, clientId: event.target.value }))}
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="fullWidth">
              <span>{textByLocale(locale, "Address or place reference", "Direccion o referencia")}</span>
              <input
                value={pointOfSaleForm.address}
                onChange={(event) => setPointOfSaleForm((current) => ({ ...current, address: event.target.value }))}
              />
            </label>
          </div>

          <div className="taskFormActions">
            <button
              className="primaryAction"
              disabled={loading || isPending || !pointOfSaleForm.name || !pointOfSaleForm.zoneId || !pointOfSaleForm.clientId}
              type="button"
              onClick={() => void createPointOfSale()}
            >
              {textByLocale(locale, "Add route stop", "Agregar parada de ruta")}
            </button>
          </div>

          <div className="taskList">
            {pointsOfSale.slice(0, 6).map((pointOfSale) => (
              <article className="taskCard" key={pointOfSale.id}>
                <div className="taskCardHeader">
                  <div>
                    <h4>{pointOfSale.name}</h4>
                    <p>
                      {provinces.find((province) => province.id === pointOfSale.provinceId)?.name ?? pointOfSale.provinceId}
                      {" / "}
                      {zones.find((zone) => zone.id === pointOfSale.zoneId)?.name ?? pointOfSale.zoneId}
                    </p>
                  </div>
                  <span className="taskBadge">{pointOfSale.code}</span>
                </div>
                {pointOfSale.address ? <p>{pointOfSale.address}</p> : null}
              </article>
            ))}
          </div>
        </article>

        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{textByLocale(locale, "Prepare consignation", "Preparar consignacion")}</h3>
              <p>
                {textByLocale(
                  locale,
                  "Supervisors can prepare consignations directly from assigned route tasks and keep the status visible for the whole team.",
                  "Los supervisores pueden preparar consignaciones directamente desde tareas de ruta asignadas y mantener el estado visible para todo el equipo."
                )}
              </p>
            </div>
          </div>

          <div className="formGrid">
            <label className="fullWidth">
              <span>{textByLocale(locale, "Route task", "Tarea de ruta")}</span>
              <select
                value={consignationForm.taskId}
                onChange={(event) => setConsignationForm((current) => ({ ...current, taskId: event.target.value }))}
              >
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="fullWidth">
              <span>{textByLocale(locale, "Supervisor note", "Nota de supervision")}</span>
              <textarea
                value={consignationForm.note}
                onChange={(event) => setConsignationForm((current) => ({ ...current, note: event.target.value }))}
              />
            </label>
          </div>

          <div className="taskFormActions">
            <button
              className="primaryAction"
              disabled={loading || isPending || !consignationForm.taskId}
              type="button"
              onClick={() => void prepareConsignation()}
            >
              {textByLocale(locale, "Prepare consignation", "Preparar consignacion")}
            </button>
          </div>

          <div className="taskList">
            {consignations.slice(0, 6).map((item) => (
              <article className="taskCard" key={item.id}>
                <div className="taskCardHeader">
                  <div>
                    <h4>{tasks.find((task) => task.id === item.taskId)?.title ?? item.taskId}</h4>
                    <p>{item.preparedAt}</p>
                  </div>
                  <span className="taskBadge">{item.status}</span>
                </div>
                {item.note ? <p>{item.note}</p> : null}
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function buildPointOfSaleCode(name: string, zoneId: string) {
  const normalizedName = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18);

  const normalizedZone = zoneId
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 10);

  return `${normalizedZone || "ZONE"}-${normalizedName || "STORE"}`;
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
