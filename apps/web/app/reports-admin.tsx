"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { t, type Locale, type ReportBootstrap, type ReportFilters, type ReportName } from "@capris/shared";
import { API_BASE_URL, authenticatedFetch, subscribeToAuthChanges } from "./auth-client";

const REPORT_NAMES: ReportName[] = ["summary", "productivity", "tasks", "client_requests"];

type ReportsAdminProps = {
  locale?: Locale;
};

type FilterState = Record<"userId" | "zoneId" | "provinceId" | "clientId" | "dateFrom" | "dateTo", string>;

const EMPTY_FILTERS: FilterState = {
  userId: "",
  zoneId: "",
  provinceId: "",
  clientId: "",
  dateFrom: "",
  dateTo: ""
};

export function ReportsAdmin({ locale = "en" }: ReportsAdminProps) {
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
    try {
      setLoading(true);
      setError(null);
      const response = await authenticatedFetch(`${API_BASE_URL}/reports/bootstrap?locale=${locale}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Unable to load reporting data."));
      }

      const payload = (await response.json()) as ReportBootstrap;
      setBootstrap(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load reporting data.");
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
        throw new Error(await extractErrorMessage(response, "Unable to generate CSV preview."));
      }

      setCsvPreview(await response.text());
      setStatusMessage("CSV preview refreshed.");
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Unable to preview CSV.");
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
        throw new Error(await extractErrorMessage(response, "Unable to create report snapshot."));
      }

      setStatusMessage("Report snapshot created.");
      startTransition(() => {
        void loadReports();
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create report snapshot.");
    }
  }

  return (
    <section className="catalogSection" id="reports">
      <div className="sectionHeading">
        <p className="eyebrow">Session 15</p>
        <h2>{t(locale, "reports.title")}</h2>
        <p className="sectionDescription">
          Generate localized CSV exports, filter them by operational scope, and create immutable report snapshots for formal reporting.
        </p>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">Loading reporting data...</p> : null}
        {isPending ? <p className="feedbackInfo">Refreshing reporting state...</p> : null}
        {statusMessage ? <p className="feedbackSuccess">{statusMessage}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
      </div>

      <div className="taskAdminLayout">
        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{t(locale, "reports.filters")}</h3>
              <p>Select a report, apply filters, preview the CSV output, then store an immutable snapshot when needed.</p>
            </div>
          </div>
          <div className="formGrid">
            <label>
              <span>Report</span>
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
                <option value="">All</option>
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
                <option value="">All</option>
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
                <option value="">All</option>
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
                <option value="">All</option>
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
            <span>CSV preview</span>
            <textarea className="csvPreview" readOnly value={csvPreview} />
          </label>
        </article>

        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{t(locale, "reports.snapshotHistory")}</h3>
              <p>Snapshots stay immutable so formal exports keep their original filters and generated content.</p>
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
                <p>Filters: {JSON.stringify(snapshot.filters)}</p>
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
      return t(locale, "reports.summary");
    case "productivity":
      return t(locale, "reports.productivity");
    case "tasks":
      return t(locale, "reports.tasks");
    case "client_requests":
      return t(locale, "reports.clientRequests");
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
