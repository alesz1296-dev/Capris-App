"use client";

import { useEffect, useState, useTransition } from "react";
import type { AppObservabilityResponse } from "@capris/shared";
import { API_BASE_URL, authenticatedFetch, subscribeToAuthChanges } from "./auth-client";
import { textByLocale, useAppLocale } from "./locale-client";

export function ObservabilityAdmin() {
  const locale = useAppLocale();
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [observability, setObservability] = useState<AppObservabilityResponse | null>(null);

  useEffect(() => {
    void loadObservability();
    return subscribeToAuthChanges(() => {
      void loadObservability();
    });
  }, [locale]);

  async function loadObservability() {
    const fallback = textByLocale(locale, "Unable to load app observability.", "No se pudo cargar la observabilidad de la app.");
    try {
      setLoading(true);
      setError(null);
      const response = await authenticatedFetch(`${API_BASE_URL}/system-health/observability`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, fallback));
      }
      setObservability((await response.json()) as AppObservabilityResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : fallback);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="catalogSection" id="observability">
      <div className="sectionHeading">
        <h2>{textByLocale(locale, "Application observability", "Observabilidad de la aplicacion")}</h2>
        <p className="sectionDescription">
          {textByLocale(
            locale,
            "Runtime health, dependency status, and operational counters for developer/SRE users.",
            "Salud de runtime, estado de dependencias y contadores operativos para desarrolladores/SRE."
          )}
        </p>
        <button className="secondaryAction sectionAction" type="button" onClick={() => startTransition(() => void loadObservability())}>
          {isPending ? textByLocale(locale, "Refreshing...", "Actualizando...") : textByLocale(locale, "Refresh observability", "Actualizar observabilidad")}
        </button>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">{textByLocale(locale, "Loading observability data...", "Cargando datos de observabilidad...")}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
      </div>

      <div className="metrics observabilityMetrics" aria-label={textByLocale(locale, "Application health metrics", "Metricas de salud de la aplicacion")}>
        <MetricCard label={textByLocale(locale, "Status", "Estado")} value={observability?.status ?? "-"} />
        <MetricCard label={textByLocale(locale, "Database", "Base de datos")} value={observability?.checks.database ?? "-"} />
        <MetricCard label={textByLocale(locale, "Failed uploads", "Cargas fallidas")} value={`${observability?.checks.failedUploads ?? 0}`} />
        <MetricCard label={textByLocale(locale, "Pending uploads", "Cargas pendientes")} value={`${observability?.checks.pendingUploads ?? 0}`} />
        <MetricCard label={textByLocale(locale, "Failed emails", "Correos fallidos")} value={`${observability?.checks.failedEmails ?? 0}`} />
        <MetricCard label={textByLocale(locale, "Active sessions", "Sesiones activas")} value={`${observability?.checks.activeSessions ?? 0}`} />
      </div>

      <div className="taskAdminLayout">
        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{textByLocale(locale, "Runtime", "Runtime")}</h3>
              <p>{textByLocale(locale, "Deployment and process metadata for operational triage.", "Metadatos de despliegue y proceso para diagnostico operativo.")}</p>
            </div>
          </div>
          <dl className="taskMetaGrid">
            <Detail label={textByLocale(locale, "Environment", "Ambiente")} value={observability?.runtime.nodeEnv ?? "-"} />
            <Detail label={textByLocale(locale, "Uptime", "Tiempo activo")} value={`${observability?.runtime.uptimeSeconds ?? 0}s`} />
            <Detail label={textByLocale(locale, "Version", "Version")} value={observability?.runtime.version ?? "-"} />
            <Detail label={textByLocale(locale, "Deployment", "Despliegue")} value={observability?.runtime.deploymentId ?? "-"} />
            <Detail label={textByLocale(locale, "Generated", "Generado")} value={observability?.generatedAt ?? "-"} />
            <Detail label={textByLocale(locale, "API", "API")} value={observability?.checks.api ?? "-"} />
          </dl>
        </article>

        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{textByLocale(locale, "Ops endpoints", "Endpoints operativos")}</h3>
              <p>{textByLocale(locale, "Use these for protected diagnostics and Prometheus scraping.", "Usa estos para diagnostico protegido y scraping de Prometheus.")}</p>
            </div>
          </div>
          <div className="observabilityLinks">
            <a className="secondaryAction" href={`${API_BASE_URL.replace(/\/$/, "")}${observability?.metrics.protectedHealthDetailsPath.replace("/api/v1", "") ?? "/system-health/details"}`}>
              {textByLocale(locale, "Health details", "Detalles de salud")}
            </a>
            <a className="secondaryAction" href={`${API_BASE_URL.replace(/\/$/, "")}${observability?.metrics.prometheusPath.replace("/api/v1", "") ?? "/metrics"}`}>
              Prometheus
            </a>
          </div>
        </article>
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
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

