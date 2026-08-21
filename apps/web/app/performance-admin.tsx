"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import {
  TASK_STATUSES,
  t,
  type FieldUserPerformanceScorecard,
  type Locale,
  type PerformanceDashboardResponse,
  type ReportBootstrap,
  type TaskStatus
} from "@capris/shared";
import { API_BASE_URL, authenticatedFetch, subscribeToAuthChanges } from "./auth-client";
import { textByLocale, useAppLocale } from "./locale-client";

type FilterState = Record<"userId" | "zoneId" | "provinceId" | "clientId" | "dateFrom" | "dateTo", string>;

const EMPTY_FILTERS: FilterState = {
  userId: "",
  zoneId: "",
  provinceId: "",
  clientId: "",
  dateFrom: "",
  dateTo: ""
};

export function PerformanceAdmin() {
  const locale = useAppLocale();
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [performance, setPerformance] = useState<PerformanceDashboardResponse | null>(null);
  const [bootstrap, setBootstrap] = useState<ReportBootstrap | null>(null);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ locale });
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        params.set(key, value);
      }
    }
    return params.toString();
  }, [filters, locale]);

  useEffect(() => {
    void loadPerformance();
    return subscribeToAuthChanges(() => {
      void loadPerformance();
    });
  }, [queryString]);

  async function loadPerformance() {
    const fallback = textByLocale(locale, "Unable to load performance data.", "No se pudieron cargar los datos de desempeno.");
    try {
      setLoading(true);
      setError(null);
      const [performancePayload, bootstrapPayload] = await Promise.all([
        fetchJson<PerformanceDashboardResponse>(`${API_BASE_URL}/performance/dashboard?${queryString}`, fallback),
        fetchJson<ReportBootstrap>(`${API_BASE_URL}/reports/bootstrap?locale=${locale}`, fallback)
      ]);
      setPerformance(performancePayload);
      setBootstrap(bootstrapPayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : fallback);
    } finally {
      setLoading(false);
    }
  }

  const summary = performance?.summary;

  return (
    <section className="catalogSection" id="performance">
      <div className="sectionHeading">
        <h2>{textByLocale(locale, "Field performance command view", "Vista de desempeno de campo")}</h2>
        <p className="sectionDescription">
          {textByLocale(
            locale,
            "Review live execution, status mix, evidence volume, and field-user scorecards from the supervisor/admin business view.",
            "Revisa ejecucion en vivo, mezcla de estados, volumen de evidencia y scorecards por usuario desde la vista de negocio."
          )}
        </p>
        <button className="secondaryAction sectionAction" type="button" onClick={() => startTransition(() => void loadPerformance())}>
          {isPending ? textByLocale(locale, "Refreshing...", "Actualizando...") : textByLocale(locale, "Refresh performance", "Actualizar desempeno")}
        </button>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">{textByLocale(locale, "Loading performance data...", "Cargando datos de desempeno...")}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
      </div>

      <div className="metrics performanceMetrics" aria-label={textByLocale(locale, "Performance metrics", "Metricas de desempeno")}>
        <MetricCard label={textByLocale(locale, "Completion", "Finalizacion")} value={`${summary?.completionRate ?? 0}%`} />
        <MetricCard label={t(locale, "dashboard.assignedTasks")} value={`${summary?.assignedTasks ?? 0}`} />
        <MetricCard label={t(locale, "dashboard.completedTasks")} value={`${summary?.completedTasks ?? 0}`} />
        <MetricCard label={textByLocale(locale, "In progress", "En proceso")} value={`${summary?.inProgressTasks ?? 0}`} />
        <MetricCard label={textByLocale(locale, "Cancelled", "Canceladas")} value={`${summary?.cancelledTasks ?? 0}`} />
        <MetricCard label={textByLocale(locale, "Rescheduled", "Reprogramadas")} value={`${summary?.rescheduledTasks ?? 0}`} />
        <MetricCard label={t(locale, "dashboard.evidenceMissing")} value={`${summary?.evidenceItems ?? 0}`} />
        <MetricCard label={t(locale, "dashboard.completedVisits")} value={`${summary?.visitsCompleted ?? 0}`} />
      </div>

      <div className="taskAdminLayout">
        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{textByLocale(locale, "Performance filters", "Filtros de desempeno")}</h3>
              <p>{textByLocale(locale, "Filter by person, geography, client, and date window.", "Filtra por persona, geografia, cliente y ventana de fechas.")}</p>
            </div>
          </div>
          <div className="formGrid">
            <SelectFilter label={t(locale, "reports.user")} value={filters.userId} onChange={(value) => setFilters((current) => ({ ...current, userId: value }))}>
              {bootstrap?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </SelectFilter>
            <SelectFilter label={t(locale, "reports.province")} value={filters.provinceId} onChange={(value) => setFilters((current) => ({ ...current, provinceId: value, zoneId: "" }))}>
              {bootstrap?.provinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
            </SelectFilter>
            <SelectFilter label={t(locale, "reports.zone")} value={filters.zoneId} onChange={(value) => setFilters((current) => ({ ...current, zoneId: value }))}>
              {bootstrap?.zones.filter((zone) => !filters.provinceId || zone.provinceId === filters.provinceId).map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
            </SelectFilter>
            <SelectFilter label={t(locale, "reports.client")} value={filters.clientId} onChange={(value) => setFilters((current) => ({ ...current, clientId: value }))}>
              {bootstrap?.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </SelectFilter>
            <label>
              <span>{t(locale, "reports.dateFrom")}</span>
              <input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
            </label>
            <label>
              <span>{t(locale, "reports.dateTo")}</span>
              <input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} />
            </label>
          </div>
        </article>

        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{textByLocale(locale, "Task status mix", "Mezcla de estados")}</h3>
              <p>{textByLocale(locale, "A quick read on how assigned work is moving.", "Lectura rapida de como avanza el trabajo asignado.")}</p>
            </div>
          </div>
          <div className="statusBreakdownGrid">
            {TASK_STATUSES.map((status) => (
              <div className="statusBreakdownItem" key={status}>
                <span>{t(locale, `status.${status}` as never)}</span>
                <strong>{performance?.statusBreakdown.find((item) => item.status === status)?.count ?? 0}</strong>
              </div>
            ))}
          </div>
        </article>
      </div>

      <ScorecardTable locale={locale} rows={performance?.scorecards ?? []} />
    </section>
  );
}

function SelectFilter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const locale = useAppLocale();
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{textByLocale(locale, "All", "Todos")}</option>
        {children}
      </select>
    </label>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ScorecardTable({ locale, rows }: { locale: Locale; rows: FieldUserPerformanceScorecard[] }) {
  return (
    <article className="catalogManagerCard scorecardPanel">
      <div className="catalogManagerHeader">
        <div>
          <h3>{textByLocale(locale, "Field-user scorecards", "Scorecards de usuarios de campo")}</h3>
          <p>{textByLocale(locale, "Sorted by completion rate and completed work.", "Ordenado por tasa de finalizacion y trabajo completado.")}</p>
        </div>
      </div>
      <div className="scorecardTableWrap">
        <table className="scorecardTable">
          <thead>
            <tr>
              <th>{t(locale, "reports.user")}</th>
              <th>{textByLocale(locale, "Rate", "Tasa")}</th>
              <th>{t(locale, "dashboard.assignedTasks")}</th>
              <th>{t(locale, "dashboard.completedTasks")}</th>
              <th>{textByLocale(locale, "Cancelled", "Canceladas")}</th>
              <th>{textByLocale(locale, "Rescheduled", "Reprogramadas")}</th>
              <th>{t(locale, "dashboard.completedVisits")}</th>
              <th>{textByLocale(locale, "Evidence", "Evidencia")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId}>
                <td>
                  <strong>{row.userName}</strong>
                  <span>{row.userId}</span>
                </td>
                <td>{row.completionRate}%</td>
                <td>{row.assignedTasks}</td>
                <td>{row.completedTasks}</td>
                <td>{row.cancelledTasks}</td>
                <td>{row.rescheduledTasks}</td>
                <td>{row.visitsCompleted}</td>
                <td>{row.evidenceItems}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="catalogEmptyState">{textByLocale(locale, "No scorecards match the current filters.", "Ningun scorecard coincide con los filtros actuales.")}</p> : null}
      </div>
    </article>
  );
}

async function fetchJson<T>(url: string, fallback: string) {
  const response = await authenticatedFetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, fallback));
  }
  return (await response.json()) as T;
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
