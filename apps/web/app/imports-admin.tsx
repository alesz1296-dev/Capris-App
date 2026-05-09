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
import { textByLocale } from "./locale-client";

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

function getImportEntityLabel(locale: Locale, entityType: ImportEntityType) {
  return textByLocale(
    locale,
    entityType.replaceAll("_", " "),
    {
      users: "usuarios",
      clients: "clientes",
      provinces: "provincias",
      zones: "zonas",
      points_of_sale: "puntos de venta",
      activity_types: "tipos de actividad",
      task_types: "tipos de tarea"
    }[entityType]
  );
}

function getReminderEventLabel(locale: Locale, eventType: ReminderRule["eventType"]) {
  return textByLocale(
    locale,
    {
      task_due: "task due",
      task_overdue: "task overdue",
      missing_evidence: "missing evidence",
      client_request_due: "client request due",
      client_request_overdue: "client request overdue"
    }[eventType],
    {
      task_due: "tarea por vencer",
      task_overdue: "tarea vencida",
      missing_evidence: "evidencia faltante",
      client_request_due: "solicitud por vencer",
      client_request_overdue: "solicitud vencida"
    }[eventType]
  );
}

function getReminderChannelLabel(locale: Locale, channel: ReminderRule["channel"]) {
  return textByLocale(locale, channel, channel === "push" ? "push" : "correo");
}

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
      setError(loadError instanceof Error ? loadError.message : textByLocale(locale, "Unable to load admin configuration.", "No se pudo cargar la configuracion administrativa."));
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
      setStatusMessage(textByLocale(locale, `Import completed for ${payload.entityType}.`, `Importacion completada para ${payload.entityType}.`));
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : textByLocale(locale, "Unable to run import.", "No se pudo ejecutar la importacion."));
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
      setStatusMessage(textByLocale(locale, "Reminder rule created.", "Regla de recordatorio creada."));
      startTransition(() => {
        void loadAdminConfig();
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : textByLocale(locale, "Unable to create reminder rule.", "No se pudo crear la regla de recordatorio."));
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

      setStatusMessage(textByLocale(locale, "Admin settings updated.", "Configuracion administrativa actualizada."));
      startTransition(() => {
        void loadAdminConfig();
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : textByLocale(locale, "Unable to save admin settings.", "No se pudo guardar la configuracion administrativa."));
    }
  }

  return (
    <section className="catalogSection" id="admin-config">
      <div className="sectionHeading">
        <p className="eyebrow">{textByLocale(locale, "Admin setup", "Configuracion administrativa")}</p>
        <h2>{textByLocale(locale, "Imports and admin configuration", "Importaciones y configuracion administrativa")}</h2>
        <p className="sectionDescription">
          {textByLocale(
            locale,
            "Load setup data by CSV, manage reminder rules, and configure default recipients and retention windows without touching code.",
            "Carga datos de configuracion por CSV, administra reglas de recordatorio y ajusta destinatarios y retencion sin tocar codigo."
          )}
        </p>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">{textByLocale(locale, "Loading import and admin settings...", "Cargando importaciones y configuracion administrativa...")}</p> : null}
        {isPending ? <p className="feedbackInfo">{textByLocale(locale, "Refreshing admin configuration...", "Actualizando configuracion administrativa...")}</p> : null}
        {statusMessage ? <p className="feedbackSuccess">{statusMessage}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
        {profile && profile.user.role !== "admin" ? (
          <p className="feedbackInfo">{textByLocale(locale, "Imports and admin configuration are limited to admin users.", "Las importaciones y la configuracion administrativa estan limitadas a usuarios administradores.")}</p>
        ) : null}
      </div>

      {profile && profile.user.role !== "admin" ? null : <div className="taskAdminLayout">
        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{textByLocale(locale, "CSV imports", "Importaciones CSV")}</h3>
              <p>{textByLocale(locale, "Paste CSV content for the selected entity. Imports upsert by unique business keys and return row-level failures.", "Pega el contenido CSV para la entidad seleccionada. Las importaciones actualizan por llaves de negocio unicas y devuelven fallos por fila.")}</p>
            </div>
          </div>
          <div className="formGrid">
            <label>
              <span>{textByLocale(locale, "Entity type", "Tipo de entidad")}</span>
              <select value={importEntityType} onChange={(event) => setImportEntityType(event.target.value as ImportEntityType)}>
                {IMPORT_ENTITY_TYPES.map((entityType) => (
                  <option key={entityType} value={entityType}>
                    {getImportEntityLabel(locale, entityType)}
                  </option>
                ))}
              </select>
            </label>
            <label className="fullWidth">
              <span>{textByLocale(locale, "CSV content", "Contenido CSV")}</span>
              <textarea className="csvPreview" value={csvContent} onChange={(event) => setCsvContent(event.target.value)} />
            </label>
          </div>
          <div className="taskFormActions">
            <button className="primaryAction" type="button" onClick={() => void runImport()}>
              {textByLocale(locale, "Run import", "Ejecutar importacion")}
            </button>
          </div>
          {lastImportResult ? (
            <div className="taskList">
              <article className="taskCard">
                <div className="taskCardHeader">
                  <div>
                    <h4>{lastImportResult.entityType}</h4>
                    <p>{textByLocale(locale, `Created ${lastImportResult.createdCount}, updated ${lastImportResult.updatedCount}, failed ${lastImportResult.failedCount}`, `Creados ${lastImportResult.createdCount}, actualizados ${lastImportResult.updatedCount}, fallidos ${lastImportResult.failedCount}`)}</p>
                  </div>
                  <span className="taskBadge">{lastImportResult.failedCount ? textByLocale(locale, "review", "revisar") : textByLocale(locale, "ok", "ok")}</span>
                </div>
                {lastImportResult.failures.map((failure) => (
                  <p key={`${failure.rowNumber}-${failure.reason}`}>{textByLocale(locale, `Row ${failure.rowNumber}: ${failure.reason}`, `Fila ${failure.rowNumber}: ${failure.reason}`)}</p>
                ))}
              </article>
            </div>
          ) : null}
        </article>

        <article className="catalogManagerCard">
          <div className="catalogManagerHeader">
            <div>
              <h3>{textByLocale(locale, "Reminder rules", "Reglas de recordatorio")}</h3>
              <p>{textByLocale(locale, "Configure reminder timing and channel for due tasks, overdue tasks, missing evidence, and client-request follow-up.", "Configura el momento y el canal de recordatorio para tareas por vencer, tareas vencidas, evidencia faltante y seguimiento de solicitudes de cliente.")}</p>
            </div>
          </div>
          <div className="formGrid">
            <label>
              <span>{textByLocale(locale, "Name", "Nombre")}</span>
              <input value={reminderForm.name} onChange={(event) => setReminderForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>{textByLocale(locale, "Event type", "Tipo de evento")}</span>
              <select value={reminderForm.eventType} onChange={(event) => setReminderForm((current) => ({ ...current, eventType: event.target.value as ReminderRule["eventType"] }))}>
                {EVENT_TYPES.map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {getReminderEventLabel(locale, eventType)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{textByLocale(locale, "Channel", "Canal")}</span>
              <select value={reminderForm.channel} onChange={(event) => setReminderForm((current) => ({ ...current, channel: event.target.value as ReminderRule["channel"] }))}>
                {CHANNELS.map((channel) => (
                  <option key={channel} value={channel}>
                    {getReminderChannelLabel(locale, channel)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{textByLocale(locale, "Offset minutes", "Minutos de anticipacion")}</span>
              <input value={reminderForm.offsetMinutes} onChange={(event) => setReminderForm((current) => ({ ...current, offsetMinutes: event.target.value }))} />
            </label>
          </div>
          <div className="taskFormActions">
            <button className="primaryAction" type="button" onClick={() => void createReminderRule()}>
              {textByLocale(locale, "Add reminder rule", "Agregar regla de recordatorio")}
            </button>
          </div>
          <div className="taskList">
            {bootstrap?.reminderRules.map((rule) => (
              <article className="taskCard" key={rule.id}>
                <div className="taskCardHeader">
                  <div>
                    <h4>{rule.name}</h4>
                    <p>{getReminderEventLabel(locale, rule.eventType)} / {getReminderChannelLabel(locale, rule.channel)}</p>
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
            <h3>{textByLocale(locale, "Recipients and retention", "Destinatarios y retencion")}</h3>
            <p>{textByLocale(locale, "Default recipients and retention windows are persisted centrally so operations can be configured without code edits.", "Los destinatarios predeterminados y las ventanas de retencion se guardan de forma centralizada para configurar operaciones sin editar codigo.")}</p>
          </div>
        </div>
        <div className="formGrid">
          <label className="fullWidth">
            <span>{textByLocale(locale, "Default recipients", "Destinatarios predeterminados")}</span>
            <input value={settingsForm.defaultRecipientEmails} onChange={(event) => setSettingsForm((current) => ({ ...current, defaultRecipientEmails: event.target.value }))} />
          </label>
          <label>
            <span>{textByLocale(locale, "Photo retention days", "Dias de retencion de fotos")}</span>
            <input value={settingsForm.retentionPhotoDays} onChange={(event) => setSettingsForm((current) => ({ ...current, retentionPhotoDays: event.target.value }))} />
          </label>
          <label>
            <span>{textByLocale(locale, "GPS retention days", "Dias de retencion de GPS")}</span>
            <input value={settingsForm.retentionGpsDays} onChange={(event) => setSettingsForm((current) => ({ ...current, retentionGpsDays: event.target.value }))} />
          </label>
          <label>
            <span>{textByLocale(locale, "Audit retention days", "Dias de retencion de auditoria")}</span>
            <input value={settingsForm.retentionAuditDays} onChange={(event) => setSettingsForm((current) => ({ ...current, retentionAuditDays: event.target.value }))} />
          </label>
        </div>
        <div className="taskFormActions">
          <button className="primaryAction" type="button" onClick={() => void saveSettings()}>
            {textByLocale(locale, "Save settings", "Guardar configuracion")}
          </button>
        </div>
        <p className="sectionDescription">
          {textByLocale(locale, "Workflow rules continue to be managed in the existing catalog admin section, so a full operational setup now combines catalogs, workflow rules, imports, reminders, recipients, and retention from the web admin shell alone.", "Las reglas de flujo siguen administrandose en la seccion actual de catalogos, asi que la configuracion operativa completa ahora combina catalogos, reglas de flujo, importaciones, recordatorios, destinatarios y retencion desde el panel web.")}
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
