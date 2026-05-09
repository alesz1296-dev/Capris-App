"use client";

import { usePathname } from "next/navigation";
import {
  type AuthProfileResponse,
  ROLE_DEFINITIONS,
  getPermissionsForRole,
  t,
  type Locale,
  type Role,
  type SupervisorScopeType
} from "@capris/shared";
import { useEffect, useState, type ReactNode } from "react";
import { AuthPanel } from "./auth-panel";
import { API_BASE_URL, authenticatedFetch, clearStoredTokens, loadStoredTokens, subscribeToAuthChanges } from "./auth-client";
import { persistPreferredLocale, textByLocale, useAppLocale } from "./locale-client";
import { PwaInstall } from "./pwa-install";

const scopeExamples: { type: SupervisorScopeType; referenceName: string }[] = [
  { type: "organization", referenceName: "Capris Costa Rica" },
  { type: "team", referenceName: "Equipo Ruta Central" },
  { type: "province", referenceName: "San Jose" }
];

const navigation = [
  { href: "/", en: "Dashboard", es: "Panel" },
  { href: "/agenda", en: "Agenda", es: "Agenda" },
  { href: "/tasks", en: "Tasks", es: "Tareas" },
  { href: "/routes", en: "Routes", es: "Rutas" },
  { href: "/activities", en: "Activities", es: "Actividades" },
  { href: "/reports", en: "Reports", es: "Reportes" },
  { href: "/imports", en: "Imports", es: "Importaciones" },
  { href: "/access", en: "Access", es: "Acceso", privileged: true }
] as const;

type AppShellProps = {
  eyebrow: { en: string; es: string };
  title: { en: string; es: string };
  description?: { en: string; es: string };
  children: ReactNode;
};

export function AppShell({ eyebrow, title, description, children }: AppShellProps) {
  const locale = useAppLocale();
  const pathname = usePathname();
  const [authState, setAuthState] = useState<"checking" | "authorized">("checking");
  const [profile, setProfile] = useState<AuthProfileResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      const tokens = loadStoredTokens();
      if (!tokens) {
        redirectToLogin(pathname);
        return;
      }

      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/auth/me`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Session is not active.");
        }

        const payload = (await response.json()) as AuthProfileResponse;
        if (pathname === "/access" && !canUsePrivilegedNavigation(payload.user.role)) {
          window.location.replace("/");
          return;
        }

        if (!cancelled) {
          setProfile(payload);
          setAuthState("authorized");
        }
      } catch {
        clearStoredTokens();
        if (!cancelled) {
          redirectToLogin(pathname);
        }
      }
    }

    void verifySession();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    return subscribeToAuthChanges(() => {
      if (!loadStoredTokens()) {
        redirectToLogin(pathname);
      }
    });
  }, [pathname]);

  if (authState === "checking") {
    return (
      <main className="loginPage">
        <section className="loginCard" aria-label={textByLocale(locale, "Checking session", "Verificando sesión")}>
          <p className="eyebrow">Capris Costa Rica</p>
          <h1>{textByLocale(locale, "Checking access", "Verificando acceso")}</h1>
          <p className="pageLead">
            {textByLocale(locale, "Confirming your session before loading the app.", "Confirmando tu sesión antes de cargar la app.")}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <strong>{t(locale, "app.name")}</strong>
        <nav>
          {navigation.filter((item) => !("privileged" in item) || canUsePrivilegedNavigation(profile?.user.role)).map((item) => {
            const active = pathname === item.href;
            return (
              <a
                aria-current={active ? "page" : undefined}
                className={active ? "sidebarLink sidebarLinkActive" : "sidebarLink"}
                href={item.href}
                key={item.href}
              >
                {locale === "es" ? item.es : item.en}
              </a>
            );
          })}
        </nav>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{locale === "es" ? eyebrow.es : eyebrow.en}</p>
            <h1>{locale === "es" ? title.es : title.en}</h1>
            {description ? <p className="pageLead">{locale === "es" ? description.es : description.en}</p> : null}
          </div>
          <div className="topbarControls">
            <AuthPanel />
            <div className="languageSwitch" aria-label={locale === "es" ? "Preferencia de idioma" : "Language preference"}>
              <button aria-pressed={locale === "en"} type="button" onClick={() => persistPreferredLocale("en")}>
                EN
              </button>
              <button aria-pressed={locale === "es"} type="button" onClick={() => persistPreferredLocale("es")}>
                ES
              </button>
            </div>
          </div>
        </header>

        <PwaInstall locale={locale} />
        {children}
      </section>
    </main>
  );
}

function redirectToLogin(pathname: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const nextPath = pathname && pathname !== "/login" ? pathname : "/";
  const next = encodeURIComponent(`${nextPath}${window.location.search}`);
  window.location.replace(`/login?next=${next}`);
}

function canUsePrivilegedNavigation(role: string | undefined) {
  return role === "admin" || role === "supervisor" || role === "developer" || role === "dev";
}

export function AccessOverview() {
  const locale = useAppLocale();

  return (
    <section className="accessSection">
      <div className="sectionHeading">
        <p className="eyebrow">{t(locale, "access.title")}</p>
        <h2>{textByLocale(locale, "Organizations, roles, and scope boundaries", "Organizaciones, roles y limites de alcance")}</h2>
      </div>

      <div className="accessGrid">
        <article className="accessPanel">
          <h3>{t(locale, "access.organizations")}</h3>
          <p>
            {textByLocale(
              locale,
              "Capris Costa Rica is the root organization for users, scope rules, and future workspace separation.",
              "Capris Costa Rica es la organizacion raiz para usuarios, reglas de alcance y futura separacion por espacios de trabajo."
            )}
          </p>
        </article>

        <article className="accessPanel">
          <h3>{t(locale, "access.scopes")}</h3>
          <ul className="list">
            {scopeExamples.map((scope) => (
              <li key={`${scope.type}-${scope.referenceName}`}>
                <strong>{t(locale, `access.scope.${scope.type}` as never)}:</strong> {scope.referenceName}
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
  );
}

function getRoleDescription(locale: Locale, role: Role) {
  const definition = ROLE_DEFINITIONS.find((entry) => entry.id === role);
  return definition ? t(locale, definition.descriptionKey as never) : "";
}
