"use client";

import { useEffect, useState, useTransition } from "react";
import type {
  AdminConfigBootstrap,
  AuthProfileResponse,
  ImportEntityType,
  ImportResult,
  Locale,
  ReminderRule,
  UpdateAdminSettingsInput
} from "@capris/shared";
import { API_BASE_URL, authenticatedFetch, subscribeToAuthChanges } from "./auth-client";

const ORGANIZATION_ID = "org_capris";

const IMPORT_ENTITY_TYPES: ImportEntityType[] = [
  "users",
  "clients",
  "provinces",
  "zones",
  "points_of_sale",
  "activity_types",
  "task_types"
];

const EVENT_TYPES: ReminderRule["eventType"][] = [
  "task_due",
  "task_overdue",
  "missing_evidence",
  "client_request_due",
  "client_request_overdue"
];

const CHANNELS: ReminderRule["channel"][] = ["push", "email"];

export function ImportsAdmin({ locale = "en" as Locale }) {
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<AdminConfigBootstrap | null>(null);
  const [profile, setProfile] = useState<AuthProfileResponse | null>(null);
  const [importEntityType, setImportEntityType] = useState<ImportEntityType>("users");
  const [csvContent, setCsvContent] = useState("");
  const [lastImportResult, setLastImportResult] = useState<ImportResult | null>(null);
  const [reminderForm, setReminderForm] = useState({
    name: "",
    eventType: "task_due" as ReminderRule["eventType"],
    channel: "push" as ReminderRule["channel"],
    offsetMinutes: "60"
  });
  const [settingsForm, setSettingsForm] = useState({
    defaultRecipientEmails: "",
    retentionPhotoDays: "365",
    retentionGpsDays: "180",
    retentionAuditDays: "730"
  });

  useEffect(() => {
    void loadAdminConfig();
    return subscribeToAuthChanges(() => {
      void loadAdminConfig();
    });
  }, []);

  async function loadAdminConfig() {
    try {
      setLoading(true);
      setError(null);
      const profileResponse = await authenticatedFetch(`${API_BASE_URL}/auth/me`, { cache: "no-store" });
      if (!profileResponse.ok) {
        throw new Error(await extractErrorMessage(profileResponse, "Unable to load auth profile."));
      }

      const profilePayload = (await profileResponse.json()) as AuthProfileResponse;
      setProfile(profilePayload);

      if (profilePayload.user.role !== "admin") {
        setBootstrap(null);
        return;
      }

      const response = await authenticatedFetch(`${API_BASE_URL}/admin-config/bootstrap`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Unable to load admin configuration."));
      }

      const payload = (await response.json()) as AdminConfigBootstrap;
      setBootstrap(payload);
      setSettingsForm({
        defaultRecipientEmails: payload.settings.defaultRecipientEmails.join(", "),
        retentionPhotoDays: String(payload.settings.retentionPhotoDays),
        retentionGpsDays: String(payload.settings.retentionGpsDays),
        retentionAuditDays: String(payload.settings.retentionAuditDays)
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load admin configuration.");
    } finally {
      setLoading(false);
    }
  }

  async function runImport() {
    try {
      setStatusMessage(null);
      setError(null);
      const response = await authenticatedFetch(`${API_BASE_URL}/admin-config/imports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: ORGANIZATION_ID,
          entityType: importEntityType,
          csvContent
        })
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Unable to run import."));
      }

      const payload = (await response.json()) as ImportResult;
      setLastImportResult(payload);
      setStatusMessage(`Import completed for ${payload.entityType}.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Unable to run import.");
    }
  }

  async function createReminderRule() {
    try {
      setStatusMessage(null);
      setError(null);
      const response = await authenticatedFetch(`${API_BASE_URL}/admin-config/reminder-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: ORGANIZATION_ID,
          name: reminderForm.name,
          eventType: reminderForm.eventType,
          channel: reminderForm.channel,
          offsetMinutes: Number(reminderForm.offsetMinutes),
          active: true
        })
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Unable to create reminder rule."));
      }

      setReminderForm({
        name: "",
        eventType: "task_due",
        channel: "push",
        offsetMinutes: "60"
      });
      setStatusMessage("Reminder rule created.");
      startTransition(() => {
        void loadAdminConfig();
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create reminder rule.");
    }
  }

  async function saveSettings() {
    try {
      setStatusMessage(null);
      setError(null);
      const payload: UpdateAdminSettingsInput = {
        organizationId: ORGANIZATION_ID,
        defaultRecipientEmails: settingsForm.defaultRecipientEmails
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean),
        retentionPhotoDays: Number(settingsForm.retentionPhotoDays),
        retentionGpsDays: Number(settingsForm.retentionGpsDays),
        retentionAuditDays: Number(settingsForm.retentionAuditDays)
      };
      const response = await authenticatedFetch(`${API_BASE_URL}/admin-config/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, "Unable to save admin settings."));
      }

      setStatusMessage("Admin settings updated.");
      startTransition(() => {
        void loadAdminConfig();
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save admin settings.");
    }
  }

  return (
    <section className="catalogSection" id="admin-config">
      <div className="sectionHeading">
        <p className="eyebrow">Session 16</p>
        <h2>Imports and admin configuration</h2>
        <p className="sectionDescription">
          Load setup data by CSV, manage reminder rules, and configure default recipients and retention windows without touching code.
        </p>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">Loading import and admin settings...</p> : null}
        {isPending ? <p className="feedbackInfo">Refreshing admin configuration...</p> : null}
        {statusMessage ? <p className="feedbackSuccess">{statusMessage}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
        {profile && profile.user.role !== "admin" ? (
          <p className="feedbackInfo">Imports and admin configuration are limited to admin users.</p>
        ) : null}
      </div>

      {profile && profile.user.role !== "admin" ? null : <div className="taskAdminLayout">
        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>CSV imports</h3>
              <p>Paste CSV content for the selected entity. Imports upsert by unique business keys and return row-level failures.</p>
            </div>
          </div>
          <div className="formGrid">
            <label>
              <span>Entity type</span>
              <select value={importEntityType} onChange={(event) => setImportEntityType(event.target.value as ImportEntityType)}>
                {IMPORT_ENTITY_TYPES.map((entityType) => (
                  <option key={entityType} value={entityType}>
                    {entityType}
                  </option>
                ))}
              </select>
            </label>
            <label className="fullWidth">
              <span>CSV content</span>
              <textarea className="csvPreview" value={csvContent} onChange={(event) => setCsvContent(event.target.value)} />
            </label>
          </div>
          <div className="taskFormActions">
            <button className="primaryAction" type="button" onClick={() => void runImport()}>
              Run import
            </button>
          </div>
          {lastImportResult ? (
            <div className="taskList">
              <article className="taskCard">
                <div className="taskCardHeader">
                  <div>
                    <h4>{lastImportResult.entityType}</h4>
                    <p>Created {lastImportResult.createdCount}, updated {lastImportResult.updatedCount}, failed {lastImportResult.failedCount}</p>
                  </div>
                  <span className="taskBadge">{lastImportResult.failedCount ? "review" : "ok"}</span>
                </div>
                {lastImportResult.failures.map((failure) => (
                  <p key={`${failure.rowNumber}-${failure.reason}`}>Row {failure.rowNumber}: {failure.reason}</p>
                ))}
              </article>
            </div>
          ) : null}
        </article>

        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>Reminder rules</h3>
              <p>Configure reminder timing and channel for due tasks, overdue tasks, missing evidence, and client-request follow-up.</p>
            </div>
          </div>
          <div className="formGrid">
            <label>
              <span>Name</span>
              <input value={reminderForm.name} onChange={(event) => setReminderForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>Event type</span>
              <select value={reminderForm.eventType} onChange={(event) => setReminderForm((current) => ({ ...current, eventType: event.target.value as ReminderRule["eventType"] }))}>
                {EVENT_TYPES.map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {eventType}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Channel</span>
              <select value={reminderForm.channel} onChange={(event) => setReminderForm((current) => ({ ...current, channel: event.target.value as ReminderRule["channel"] }))}>
                {CHANNELS.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Offset minutes</span>
              <input value={reminderForm.offsetMinutes} onChange={(event) => setReminderForm((current) => ({ ...current, offsetMinutes: event.target.value }))} />
            </label>
          </div>
          <div className="taskFormActions">
            <button className="primaryAction" type="button" onClick={() => void createReminderRule()}>
              Add reminder rule
            </button>
          </div>
          <div className="taskList">
            {bootstrap?.reminderRules.map((rule) => (
              <article className="taskCard" key={rule.id}>
                <div className="taskCardHeader">
                  <div>
                    <h4>{rule.name}</h4>
                    <p>{rule.eventType} / {rule.channel}</p>
                  </div>
                  <span className="taskBadge">{rule.offsetMinutes}m</span>
                </div>
              </article>
            ))}
          </div>
        </article>
      </div>}

      {profile && profile.user.role !== "admin" ? null : <article className="catalogManagerCard">
        <div className="catalogManagerHeader">
          <div>
            <h3>Recipients and retention</h3>
            <p>Default recipients and retention windows are persisted centrally so operations can be configured without code edits.</p>
          </div>
        </div>
        <div className="formGrid">
          <label className="fullWidth">
            <span>Default recipients</span>
            <input value={settingsForm.defaultRecipientEmails} onChange={(event) => setSettingsForm((current) => ({ ...current, defaultRecipientEmails: event.target.value }))} />
          </label>
          <label>
            <span>Photo retention days</span>
            <input value={settingsForm.retentionPhotoDays} onChange={(event) => setSettingsForm((current) => ({ ...current, retentionPhotoDays: event.target.value }))} />
          </label>
          <label>
            <span>GPS retention days</span>
            <input value={settingsForm.retentionGpsDays} onChange={(event) => setSettingsForm((current) => ({ ...current, retentionGpsDays: event.target.value }))} />
          </label>
          <label>
            <span>Audit retention days</span>
            <input value={settingsForm.retentionAuditDays} onChange={(event) => setSettingsForm((current) => ({ ...current, retentionAuditDays: event.target.value }))} />
          </label>
        </div>
        <div className="taskFormActions">
          <button className="primaryAction" type="button" onClick={() => void saveSettings()}>
            Save settings
          </button>
        </div>
        <p className="sectionDescription">
          Workflow rules continue to be managed in the existing catalog admin section, so a full operational setup now combines catalogs, workflow rules, imports, reminders, recipients, and retention from the web admin shell alone.
        </p>
      </article>}
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
