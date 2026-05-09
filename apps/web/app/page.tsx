"use client";

import {
  ROLE_DEFINITIONS,
  getPermissionsForRole,
  t,
  type Locale,
  type Role,
  type SupervisorScopeType
} from "@capris/shared";
import { AuthPanel } from "./auth-panel";
import { AgendaAdmin } from "./agenda-admin";
import { ActivitiesAdmin } from "./activities-admin";
import { CatalogAdmin } from "./catalog-admin";
import { DashboardOverview } from "./dashboard-overview";
import { EvidenceAdmin } from "./evidence-admin";
import { ExceptionsAdmin } from "./exceptions-admin";
import { ImportsAdmin } from "./imports-admin";
import { ReportsAdmin } from "./reports-admin";
import { TaskAdmin } from "./task-admin";
import { VisitAdmin } from "./visit-admin";
import { persistPreferredLocale, textByLocale, useAppLocale } from "./locale-client";

const scopeExamples: { type: SupervisorScopeType; referenceName: string }[] = [
  { type: "organization", referenceName: "Capris Costa Rica" },
  { type: "team", referenceName: "Central Route Team" },
  { type: "province", referenceName: "San Jose" }
];

function getScopeLabel(locale: Locale, type: SupervisorScopeType) {
  return t(locale, `access.scope.${type}`);
}

function getRoleDescription(locale: Locale, role: Role) {
  const definition = ROLE_DEFINITIONS.find((entry) => entry.id === role);
  return definition ? t(locale, definition.descriptionKey as never) : "";
}

export default function DashboardPage() {
  const locale = useAppLocale();

  return (
    <main className="shell">
      <aside className="sidebar">
        <strong>{t(locale, "app.name")}</strong>
        <nav>
          <a href="#dashboard">{textByLocale(locale, "Dashboard", "Panel")}</a>
          <a href="#agenda">{textByLocale(locale, "Agenda", "Agenda")}</a>
          <a href="#tasks">{textByLocale(locale, "Tasks", "Tareas")}</a>
          <a href="#routes">{textByLocale(locale, "Routes", "Rutas")}</a>
          <a href="#evidence">{textByLocale(locale, "Evidence", "Evidencia")}</a>
          <a href="#activities">{textByLocale(locale, "Activities", "Actividades")}</a>
          <a href="#exceptions">{textByLocale(locale, "Exceptions", "Excepciones")}</a>
          <a href="#reports">{textByLocale(locale, "Reports", "Reportes")}</a>
          <a href="#admin-config">{textByLocale(locale, "Config", "Configuracion")}</a>
          <a href="#settings">{textByLocale(locale, "Admin", "Admin")}</a>
        </nav>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{textByLocale(locale, "Costa Rica operations", "Operaciones Costa Rica")}</p>
            <h1>{textByLocale(locale, "Supervisor dashboard", "Panel de supervisor")}</h1>
          </div>
          <div className="topbarControls">
            <AuthPanel />
            <div className="languageSwitch" aria-label="Language preference">
              <button aria-pressed={locale === "en"} type="button" onClick={() => persistPreferredLocale("en")}>EN</button>
              <button aria-pressed={locale === "es"} type="button" onClick={() => persistPreferredLocale("es")}>ES</button>
            </div>
          </div>
        </header>

        <DashboardOverview />

        <section className="accessSection" id="settings">
          <div className="sectionHeading">
            <p className="eyebrow">{t(locale, "access.title")}</p>
            <h2>{textByLocale(locale, "Organizations, roles, and scope boundaries", "Organizaciones, roles y limites de alcance")}</h2>
          </div>

          <div className="accessGrid">
            <article className="accessPanel">
              <h3>{t(locale, "access.organizations")}</h3>
              <p>{textByLocale(locale, "Capris Costa Rica is the root organization for users, scope rules, and future workspace separation.", "Capris Costa Rica es la organizacion raiz para usuarios, reglas de alcance y futura separacion por espacios de trabajo.")}</p>
            </article>

            <article className="accessPanel">
              <h3>{t(locale, "access.scopes")}</h3>
              <ul className="list">
                {scopeExamples.map((scope) => (
                  <li key={`${scope.type}-${scope.referenceName}`}>
                    <strong>{getScopeLabel(locale, scope.type)}:</strong> {scope.referenceName}
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <div className="roleGrid">
            {ROLE_DEFINITIONS.map((role) => (
              <article className="roleCard" key={role.id}>
                <div>
                  <p className="roleName">{t(locale, role.nameKey as never)}</p>
                  <p className="roleDescription">{getRoleDescription(locale, role.id)}</p>
                </div>
                <ul className="list compact">
                  {getPermissionsForRole(role.id).map((permission) => (
                    <li key={permission}>{permission}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <AgendaAdmin />
        <VisitAdmin />
        <EvidenceAdmin />
        <ActivitiesAdmin />
        <ExceptionsAdmin />
        <ReportsAdmin />
        <ImportsAdmin />
        <TaskAdmin />
        <CatalogAdmin />
      </section>
    </main>
  );
}

