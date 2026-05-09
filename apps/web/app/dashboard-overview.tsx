"use client";

import { useEffect, useState, useTransition } from "react";
import { t, type DashboardResponse, type EvidenceBootstrap, type Locale, type ProductivitySummary, type VisitBootstrap } from "@capris/shared";
import { API_BASE_URL, authenticatedFetch, subscribeToAuthChanges } from "./auth-client";
import { textByLocale } from "./locale-client";
import { ProvinceOperationsMap } from "./province-operations-map";

type DashboardOverviewProps = {
  locale?: Locale;
};

export function DashboardOverview({ locale = "en" }: DashboardOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [visitBootstrap, setVisitBootstrap] = useState<VisitBootstrap | null>(null);
  const [evidenceBootstrap, setEvidenceBootstrap] = useState<EvidenceBootstrap | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    void loadDashboard();
    return subscribeToAuthChanges(() => {
      void loadDashboard();
    });
  }, [locale]);

  async function loadDashboard() {
    const loadErrorFallback = textByLocale(locale, "Unable to load dashboard metrics.", "No se pudieron cargar las metricas del panel.");
    try {
      setLoading(true);
      setError(null);
      setMapError(null);
      const response = await authenticatedFetch(`${API_BASE_URL}/dashboard?locale=${locale}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, loadErrorFallback));
      }

      const payload = (await response.json()) as DashboardResponse;
      setDashboard(payload);

      const [visitsResult, evidenceResult] = await Promise.allSettled([
        fetchJson<VisitBootstrap>(`${API_BASE_URL}/visits/bootstrap`, textByLocale(locale, "Unable to load route map data.", "No se pudieron cargar los datos del mapa de rutas.")),
        fetchJson<EvidenceBootstrap>(`${API_BASE_URL}/evidence/bootstrap`, textByLocale(locale, "Unable to load evidence map data.", "No se pudieron cargar los datos del mapa de evidencia."))
      ]);

      if (visitsResult.status === "fulfilled") {
        setVisitBootstrap(visitsResult.value);
      } else {
        setVisitBootstrap(null);
        setMapError(visitsResult.reason instanceof Error ? visitsResult.reason.message : loadErrorFallback);
      }

      if (evidenceResult.status === "fulfilled") {
        setEvidenceBootstrap(evidenceResult.value);
      } else {
        setEvidenceBootstrap(null);
        setMapError((current) => current ?? (evidenceResult.reason instanceof Error ? evidenceResult.reason.message : loadErrorFallback));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : loadErrorFallback);
    } finally {
      setLoading(false);
    }
  }

  const summary = dashboard?.summary;

  return (
    <section className="catalogSection" id="dashboard">
      <div className="sectionHeading">
        <h2>{textByLocale(locale, "Dashboard and productivity", "Panel y productividad")}</h2>
        <p className="sectionDescription">
          {textByLocale(
            locale,
            "Completion, overdue work, route coverage, missing evidence, activity counts, and grouped productivity now come from live operational data.",
            "Finalizacion, trabajo vencido, cobertura de ruta, evidencia faltante, conteos de actividad y productividad agrupada ahora vienen de datos operativos en vivo."
          )}
        </p>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">{textByLocale(locale, "Loading live dashboard data...", "Cargando datos en vivo del panel...")}</p> : null}
        {isPending ? <p className="feedbackInfo">{textByLocale(locale, "Refreshing dashboard...", "Actualizando panel...")}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
      </div>

      <div className="metrics" aria-label={textByLocale(locale, "Operational metrics", "Metricas operativas")}>
        <MetricCard label={t(locale, "dashboard.taskCompletion")} value={`${summary?.completionRate ?? 0}%`} />
        <MetricCard label={t(locale, "dashboard.pendingTasks")} value={`${summary?.pendingTasks ?? 0}`} />
        <MetricCard label={t(locale, "dashboard.overdueTasks")} value={`${summary?.overdueTasks ?? 0}`} />
        <MetricCard label={t(locale, "dashboard.routeCoverage")} value={`${summary?.routeCoverageRate ?? 0}%`} />
        <MetricCard label={t(locale, "dashboard.evidenceMissing")} value={`${summary?.tasksMissingEvidence ?? 0}`} />
        <MetricCard label={t(locale, "dashboard.activitiesCompleted")} value={`${summary?.activitiesCount ?? 0}`} />
        <MetricCard label={t(locale, "dashboard.openClientRequests")} value={`${summary?.openClientRequests ?? 0}`} />
        <MetricCard label={t(locale, "dashboard.overdueClientRequests")} value={`${summary?.overdueClientRequests ?? 0}`} />
      </div>

      <ProvinceOperationsMap
        locale={locale}
        visitBootstrap={visitBootstrap}
        evidenceBootstrap={evidenceBootstrap}
        loading={loading}
        error={mapError}
      />

      <section className="operations">
        <div>
          <h2>{t(locale, "dashboard.productivity")}</h2>
          <p>
            {t(locale, "dashboard.byFieldUser")} / {t(locale, "dashboard.byZone")} / {t(locale, "dashboard.byProvince")} / {t(locale, "dashboard.byClient")}
          </p>
          <button className="secondaryAction" type="button" onClick={() => startTransition(() => void loadDashboard())}>
            {textByLocale(locale, "Refresh dashboard", "Actualizar panel")}
          </button>
        </div>
        <div>
          <h2>{textByLocale(locale, "Operational health", "Salud operativa")}</h2>
          <p>
            {t(locale, "dashboard.failedUploads")}: {summary?.failedUploads ?? 0}
          </p>
          <p>
            {t(locale, "dashboard.failedEmails")}: {summary?.failedEmails ?? 0}
          </p>
          <p>
            {t(locale, "dashboard.averageRequestAging")}: {summary?.averageClientRequestAgingDays ?? 0}
          </p>
        </div>
      </section>

      <div className="taskAdminLayout">
        <ProductivityPanel
          title={t(locale, "dashboard.byFieldUser")}
          rows={dashboard?.productivity.fieldUsers ?? []}
          locale={locale}
        />
        <ProductivityPanel title={t(locale, "dashboard.byZone")} rows={dashboard?.productivity.zones ?? []} locale={locale} />
        <ProductivityPanel title={t(locale, "dashboard.byProvince")} rows={dashboard?.productivity.provinces ?? []} locale={locale} />
        <ProductivityPanel title={t(locale, "dashboard.byClient")} rows={dashboard?.productivity.clients ?? []} locale={locale} />
      </div>
    </section>
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

function ProductivityPanel({
  title,
  rows,
  locale
}: {
  title: string;
  rows: ProductivitySummary[];
  locale: Locale;
}) {
  return (
    <article className="catalogManagerCard">
      <div className="catalogManagerHeader">
        <div>
          <h3>{title}</h3>
          <p>{rows.length ? textByLocale(locale, `${rows.length} rows`, `${rows.length} filas`) : textByLocale(locale, "No productivity data yet.", "Todavia no hay datos de productividad.")}</p>
        </div>
      </div>
      <div className="taskList">
        {rows.map((row) => (
          <article className="taskCard" key={`${row.dimension}-${row.referenceId}`}>
            <div className="taskCardHeader">
              <div>
                <h4>{row.label}</h4>
                <p>{row.referenceId}</p>
              </div>
              <span className="taskBadge">{row.completionRate}%</span>
            </div>
            <dl className="taskMetaGrid">
              <div>
                <dt>{t(locale, "dashboard.assignedTasks")}</dt>
                <dd>{row.assignedTasks}</dd>
              </div>
              <div>
                <dt>{t(locale, "dashboard.completedTasks")}</dt>
                <dd>{row.completedTasks}</dd>
              </div>
              <div>
                <dt>{t(locale, "dashboard.completedVisits")}</dt>
                <dd>{row.visitsCompleted}</dd>
              </div>
              <div>
                <dt>{t(locale, "dashboard.activitiesCount")}</dt>
                <dd>{row.activitiesCount}</dd>
              </div>
              <div>
                <dt>{t(locale, "dashboard.exhibitionsCount")}</dt>
                <dd>{row.exhibitionsCount}</dd>
              </div>
              <div>
                <dt>{t(locale, "dashboard.requestsOverdue")}</dt>
                <dd>
                  {row.overdueClientRequests} / {row.openClientRequests}
                </dd>
              </div>
            </dl>
          </article>
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

async function fetchJson<T>(url: string, fallback: string) {
  const response = await authenticatedFetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, fallback));
  }

  return (await response.json()) as T;
}
