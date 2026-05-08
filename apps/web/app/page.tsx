import {
  ROLE_DEFINITIONS,
  getPermissionsForRole,
  t,
  type Role,
  type SupervisorScopeType
} from "@capris/shared";
import { AuthPanel } from "./auth-panel";
import { CatalogAdmin } from "./catalog-admin";
import { EvidenceAdmin } from "./evidence-admin";
import { TaskAdmin } from "./task-admin";
import { VisitAdmin } from "./visit-admin";

const metrics = [
  { label: "Task completion", value: "0%" },
  { label: "Route coverage", value: "0%" },
  { label: "Evidence missing", value: "1" },
  { label: "Sync/email health", value: "OK" }
];

const scopeExamples: { type: SupervisorScopeType; referenceName: string }[] = [
  { type: "organization", referenceName: "Capris Costa Rica" },
  { type: "team", referenceName: "Central Route Team" },
  { type: "province", referenceName: "San Jose" }
];

function getScopeLabel(type: SupervisorScopeType) {
  return t("en", `access.scope.${type}`);
}

function getRoleDescription(role: Role) {
  const definition = ROLE_DEFINITIONS.find((entry) => entry.id === role);
  return definition ? t("en", definition.descriptionKey as never) : "";
}

export default function DashboardPage() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <strong>{t("en", "app.name")}</strong>
        <nav>
          <a href="#dashboard">Dashboard</a>
          <a href="#tasks">Tasks</a>
          <a href="#routes">Routes</a>
          <a href="#evidence">Evidence</a>
          <a href="#reports">Reports</a>
          <a href="#settings">Admin</a>
        </nav>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Costa Rica operations</p>
            <h1>Supervisor dashboard</h1>
          </div>
          <div className="topbarControls">
            <AuthPanel />
            <div className="languageSwitch" aria-label="Language preference">
              <button>EN</button>
              <button>ES</button>
            </div>
          </div>
        </header>

        <section className="metrics" aria-label="Operational metrics">
          {metrics.map((metric) => (
            <article className="metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </section>

        <section className="operations">
          <div>
            <h2>Today&apos;s route</h2>
            <p>Assigned visits, check-ins, required evidence, and route coverage will appear here.</p>
          </div>
          <div>
            <h2>Exceptions</h2>
            <p>Missing GPS, failed uploads, closed stores, and failed consignation emails will be reviewed here.</p>
          </div>
        </section>

        <section className="accessSection" id="settings">
          <div className="sectionHeading">
            <p className="eyebrow">{t("en", "access.title")}</p>
            <h2>Organizations, roles, and scope boundaries</h2>
          </div>

          <div className="accessGrid">
            <article className="accessPanel">
              <h3>{t("en", "access.organizations")}</h3>
              <p>Capris Costa Rica is the root organization for users, scope rules, and future workspace separation.</p>
            </article>

            <article className="accessPanel">
              <h3>{t("en", "access.scopes")}</h3>
              <ul className="list">
                {scopeExamples.map((scope) => (
                  <li key={`${scope.type}-${scope.referenceName}`}>
                    <strong>{getScopeLabel(scope.type)}:</strong> {scope.referenceName}
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <div className="roleGrid">
            {ROLE_DEFINITIONS.map((role) => (
              <article className="roleCard" key={role.id}>
                <div>
                  <p className="roleName">{t("en", role.nameKey as never)}</p>
                  <p className="roleDescription">{getRoleDescription(role.id)}</p>
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

        <VisitAdmin />
        <EvidenceAdmin />
        <TaskAdmin />
        <CatalogAdmin />
      </section>
    </main>
  );
}
