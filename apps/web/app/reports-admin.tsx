"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { t, type Locale, type ReportBootstrap, type ReportFilters, type ReportName } from "@capris/shared";
import { API_BASE_URL, authenticatedFetch, subscribeToAuthChanges } from "./auth-client";
import { textByLocale, useAppLocale } from "./locale-client";

const REPORT_NAMES: ReportName[] = ["summary", "productivity", "tasks", "client_requests"];

type FilterState = Record<"userId" | "zoneId" | "provinceId" | "clientId" | "dateFrom" | "dateTo", string>;

const EMPTY_FILTERS: FilterState = {
  userId: "",
  zoneId: "",
  provinceId: "",
  clientId: "",
  dateFrom: "",
  dateTo: ""
};

export function ReportsAdmin() {
  const locale = useAppLocale();
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<ReportBootstrap | null>(null);
  const [reportName, setReportName] = useState<ReportName>("summary");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [csvPreview, setCsvPreview] = useState<string>("");

  useEffect(() => {
    void loadReports();
    return subscribeToAuthChanges(() => {
      void loadReports();
    });
  }, [locale]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ locale });
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        params.set(key, value);
      }
    }
    return params.toString();
  }, [filters, locale]);

  async function loadReports() {
    const loadFallback = textByLocale(locale, "Unable to load reporting data.", "No se pudieron cargar los datos de reportes.");
    try {
      setLoading(true);
      setError(null);
      const response = await authenticatedFetch(`${API_BASE_URL}/reports/bootstrap?locale=${locale}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, loadFallback));
      }

      const payload = (await response.json()) as ReportBootstrap;
      setBootstrap(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : loadFallback);
    } finally {
      setLoading(false);
    }
  }

  async function previewCsv() {
    try {
      setStatusMessage(null);
      setError(null);
      const response = await authenticatedFetch(`${API_BASE_URL}/reports/${reportName}.csv?${queryString}`, {
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, textByLocale(locale, "Unable to generate CSV preview.", "No se pudo generar la vista previa CSV.")));
      }

      setCsvPreview(await response.text());
      setStatusMessage(textByLocale(locale, "CSV preview refreshed.", "Vista previa CSV actualizada."));
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : textByLocale(locale, "Unable to preview CSV.", "No se pudo previsualizar el CSV."));
    }
  }

  async function createSnapshot() {
    try {
      setStatusMessage(null);
      setError(null);
      const response = await authenticatedFetch(`${API_BASE_URL}/reports/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportName,
          locale,
          filters: normalizeFilters(filters)
        })
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, textByLocale(locale, "Unable to create report snapshot.", "No se pudo crear la instantanea del reporte.")));
      }

      setStatusMessage(textByLocale(locale, "Report snapshot created.", "Instantanea del reporte creada."));
      startTransition(() => {
        void loadReports();
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : textByLocale(locale, "Unable to create report snapshot.", "No se pudo crear la instantanea del reporte."));
    }
  }

  return (
    <section className="catalogSection" id="reports">
      <div className="sectionHeading">
        <h2>{t(locale, "reports.title")}</h2>
        <p className="sectionDescription">
          {textByLocale(locale, "Generate localized CSV exports, filter them by operational scope, and create immutable report snapshots for formal reporting.", "Genera exportaciones CSV localizadas, filtralas por alcance operativo y crea instantaneas inmutables para reportes formales.")}
        </p>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">{textByLocale(locale, "Loading reporting data...", "Cargando datos de reportes...")}</p> : null}
        {isPending ? <p className="feedbackInfo">{textByLocale(locale, "Refreshing reporting state...", "Actualizando estado de reportes...")}</p> : null}
        {statusMessage ? <p className="feedbackSuccess">{statusMessage}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
      </div>

      <div className="taskAdminLayout">
        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{t(locale, "reports.filters")}</h3>
              <p>{textByLocale(locale, "Select a report, apply filters, preview the CSV output, then store an immutable snapshot when needed.", "Selecciona un reporte, aplica filtros, previsualiza la salida CSV y luego guarda una instantanea inmutable cuando haga falta.")}</p>
            </div>
          </div>
          <div className="formGrid">
            <label>
              <span>{textByLocale(locale, "Report", "Reporte")}</span>
              <select value={reportName} onChange={(event) => setReportName(event.target.value as ReportName)}>
                {REPORT_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {reportLabel(locale, name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t(locale, "reports.user")}</span>
              <select value={filters.userId} onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value }))}>
                <option value="">{textByLocale(locale, "All", "Todos")}</option>
                {bootstrap?.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t(locale, "reports.province")}</span>
              <select value={filters.provinceId} onChange={(event) => setFilters((current) => ({ ...current, provinceId: event.target.value, zoneId: "" }))}>
                <option value="">{textByLocale(locale, "All", "Todos")}</option>
                {bootstrap?.provinces.map((province) => (
                  <option key={province.id} value={province.id}>
                    {province.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t(locale, "reports.zone")}</span>
              <select value={filters.zoneId} onChange={(event) => setFilters((current) => ({ ...current, zoneId: event.target.value }))}>
                <option value="">{textByLocale(locale, "All", "Todos")}</option>
                {bootstrap?.zones
                  .filter((zone) => !filters.provinceId || zone.provinceId === filters.provinceId)
                  .map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>{t(locale, "reports.client")}</span>
              <select value={filters.clientId} onChange={(event) => setFilters((current) => ({ ...current, clientId: event.target.value }))}>
                <option value="">{textByLocale(locale, "All", "Todos")}</option>
                {bootstrap?.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t(locale, "reports.dateFrom")}</span>
              <input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
            </label>
            <label>
              <span>{t(locale, "reports.dateTo")}</span>
              <input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} />
            </label>
          </div>
          <div className="taskFormActions">
            <button className="secondaryAction" type="button" onClick={() => void previewCsv()}>
              {t(locale, "reports.exportCsv")}
            </button>
            <button className="primaryAction" type="button" onClick={() => void createSnapshot()}>
              {t(locale, "reports.snapshot")}
            </button>
          </div>
          <label className="fullWidth">
            <span>{textByLocale(locale, "CSV preview", "Vista previa CSV")}</span>
            <textarea className="csvPreview" readOnly value={csvPreview} />
          </label>
        </article>

        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{t(locale, "reports.snapshotHistory")}</h3>
              <p>{textByLocale(locale, "Snapshots stay immutable so formal exports keep their original filters and generated content.", "Las instantaneas se mantienen inmutables para que los exportes formales conserven sus filtros y contenido original generado.")}</p>
            </div>
          </div>
          <div className="taskList">
            {bootstrap?.snapshots.map((snapshot) => (
              <article className="taskCard" key={snapshot.id}>
                <div className="taskCardHeader">
                  <div>
                    <h4>{reportLabel(locale, snapshot.reportName)}</h4>
                <p>{snapshot.fileName}</p>
                  </div>
                  <span className="taskBadge">{snapshot.locale.toUpperCase()}</span>
                </div>
                <p>
                  {t(locale, "reports.generatedAt")}: {snapshot.generatedAt}
                </p>
                <p>
                  {t(locale, "reports.rowCount")}: {snapshot.rowCount}
                </p>
                <p>{textByLocale(locale, "Filters", "Filtros")}: {JSON.stringify(snapshot.filters)}</p>
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function normalizeFilters(filters: FilterState): ReportFilters {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) as ReportFilters;
}

function reportLabel(locale: Locale, name: ReportName) {
  switch (name) {
    case "summary":
      return locale === "es" ? "Resumen" : t(locale, "reports.summary");
    case "productivity":
      return locale === "es" ? "Productividad" : t(locale, "reports.productivity");
    case "tasks":
      return locale === "es" ? "Tareas" : t(locale, "reports.tasks");
    case "client_requests":
      return locale === "es" ? "Solicitudes de cliente" : t(locale, "reports.clientRequests");
  }
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
