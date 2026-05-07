import {
  ROLE_DEFINITIONS,
  getPermissionsForRole,
  t,
  type Client,
  type PointOfSale,
  type Province,
  type Role,
  type SupervisorScopeType,
  type Zone
} from "@capris/shared";

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

const provinces: Province[] = [
  {
    id: "province_san_jose",
    organizationId: "org_capris",
    country: "Costa Rica",
    name: "San Jose",
    code: "SJ",
    active: true
  },
  {
    id: "province_alajuela",
    organizationId: "org_capris",
    country: "Costa Rica",
    name: "Alajuela",
    code: "AL",
    active: true
  }
];

const zones: Zone[] = [
  {
    id: "zone_central",
    organizationId: "org_capris",
    provinceId: "province_san_jose",
    name: "Central",
    code: "CENTRAL",
    active: true
  },
  {
    id: "zone_west",
    organizationId: "org_capris",
    provinceId: "province_alajuela",
    name: "West",
    code: "WEST",
    active: true
  }
];

const clients: Client[] = [
  {
    id: "client_auto_mercado",
    organizationId: "org_capris",
    name: "Auto Mercado",
    code: "AUTOMERCADO",
    contactEmail: "trade@automercado.example",
    active: true
  },
  {
    id: "client_walmart",
    organizationId: "org_capris",
    name: "Walmart",
    code: "WALMART",
    contactEmail: "ops@walmart.example",
    active: true
  }
];

const pointsOfSale: PointOfSale[] = [
  {
    id: "pos_escazu_001",
    organizationId: "org_capris",
    provinceId: "province_san_jose",
    zoneId: "zone_central",
    clientId: "client_auto_mercado",
    name: "Escazu Plaza",
    code: "ESCAZU-001",
    address: "Escazu, San Jose",
    latitude: 9.9186,
    longitude: -84.1397,
    active: true
  }
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
          <div className="languageSwitch" aria-label="Language preference">
            <button>EN</button>
            <button>ES</button>
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

        <section className="catalogSection" id="routes">
          <div className="sectionHeading">
            <p className="eyebrow">Catalogs</p>
            <h2>Costa Rica geography, clients, and points of sale</h2>
          </div>

          <div className="catalogGrid">
            <article className="accessPanel">
              <h3>Provinces</h3>
              <ul className="list compact">
                {provinces.map((province) => (
                  <li key={province.id}>
                    {province.name} ({province.code})
                  </li>
                ))}
              </ul>
            </article>

            <article className="accessPanel">
              <h3>Zones</h3>
              <ul className="list compact">
                {zones.map((zone) => (
                  <li key={zone.id}>
                    {zone.name} ({zone.code})
                  </li>
                ))}
              </ul>
            </article>

            <article className="accessPanel">
              <h3>Clients</h3>
              <ul className="list compact">
                {clients.map((client) => (
                  <li key={client.id}>
                    {client.name} ({client.code})
                  </li>
                ))}
              </ul>
            </article>

            <article className="accessPanel">
              <h3>Points of sale</h3>
              <ul className="list compact">
                {pointsOfSale.map((point) => (
                  <li key={point.id}>
                    {point.name} ({point.code})
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
