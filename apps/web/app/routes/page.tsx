"use client";

import Link from "next/link";
import { AppShell } from "../app-shell";
import { textByLocale, useAppLocale } from "../locale-client";
import { RouteSectionNav } from "../route-section-nav";

export default function RoutesPage() {
  const locale = useAppLocale();

  return (
    <AppShell
      eyebrow={{ en: "Route execution", es: "Ejecucion de ruta" }}
      title={{ en: "Visits and route control", es: "Visitas y control de ruta" }}
      description={{
        en: "Run route stops, check-ins, and check-outs by province, canton, and district without mixing them into the full dashboard.",
        es: "Ejecuta paradas de ruta, entradas y salidas por provincia, canton y distrito sin mezclarlas con todo el panel principal."
      }}
    >
      <RouteSectionNav locale={locale} />

      <section className="routeCommandCenter">
        <div>
          <p className="eyebrow">{textByLocale(locale, "Daily route", "Ruta diaria")}</p>
          <h2>{textByLocale(locale, "A cleaner space to move between functions", "Un espacio mas limpio para moverse por funciones")}</h2>
          <p>
            {textByLocale(
              locale,
              "Routes now works as an entry point. Each important block has its own page so mobile users do not need to scroll through one huge screen.",
              "Rutas ahora funciona como un punto de entrada. Cada bloque importante tiene su propia pagina para que en movil no haga falta recorrer una pantalla larguisima."
            )}
          </p>
        </div>
        <nav aria-label={textByLocale(locale, "Route tools", "Herramientas de ruta")}>
          <Link href="/routes/day">{textByLocale(locale, "Route day", "Dia de ruta")}</Link>
          <Link href="/routes/planning">{textByLocale(locale, "Planning", "Planeacion")}</Link>
          <Link href="/evidence">{textByLocale(locale, "Evidence", "Evidencia")}</Link>
          <Link href="/exceptions">{textByLocale(locale, "Exceptions", "Excepciones")}</Link>
        </nav>
      </section>

      <section className="catalogSection routeWorkflowSection">
        <div className="sectionHeading">
          <p className="eyebrow">{textByLocale(locale, "Separated functions", "Funciones separadas")}</p>
          <h2>{textByLocale(locale, "Less scrolling, more context per screen", "Menos scroll, mas contexto por pantalla")}</h2>
          <p className="sectionDescription">
            {textByLocale(
              locale,
              "Each page keeps the existing tools, now grouped by goal so daily work feels clearer on desktop and lighter on mobile.",
              "Cada pagina conserva las herramientas existentes, pero ahora agrupadas por objetivo para que el trabajo diario se sienta mas claro en desktop y mucho mas ligero en movil."
            )}
          </p>
        </div>
        <div className="routeWorkflowGrid">
          <article className="routeWorkflowCard">
            <span className="taskBadge">1</span>
            <h3>{textByLocale(locale, "Route day", "Dia de ruta")}</h3>
            <p>{textByLocale(locale, "Visits, check-in, check-out, and administrative location in one execution-focused screen.", "Visitas, check-in, check-out y ubicacion administrativa en una sola pantalla enfocada en ejecucion.")}</p>
            <div className="taskCardActions">
              <Link className="primaryAction routeWorkflowLink" href="/routes/day">
                {textByLocale(locale, "Open route day", "Abrir dia de ruta")}
              </Link>
            </div>
          </article>
          <article className="routeWorkflowCard">
            <span className="taskBadge">2</span>
            <h3>{textByLocale(locale, "Planning", "Planeacion")}</h3>
            <p>{textByLocale(locale, "Shared stops and consignations in a separate page, with direct links to tasks and agenda.", "Paradas compartidas y consignaciones en una pagina separada, con accesos directos a tareas y agenda.")}</p>
            <div className="taskCardActions">
              <Link className="secondaryAction routeWorkflowLink" href="/routes/planning">
                {textByLocale(locale, "Open planning", "Abrir planeacion")}
              </Link>
            </div>
          </article>
          <article className="routeWorkflowCard">
            <span className="taskBadge">3</span>
            <h3>{textByLocale(locale, "Evidence and exceptions", "Evidencia y excepciones")}</h3>
            <p>{textByLocale(locale, "Review uploads, previews, blockers, and approvals without burying them at the end of the routes page.", "Revision de cargas, vistas previas, bloqueos y aprobaciones sin quedar enterradas al final de la pagina de rutas.")}</p>
            <div className="taskCardActions">
              <Link className="secondaryAction routeWorkflowLink" href="/evidence">
                {textByLocale(locale, "Go to evidence", "Ir a evidencia")}
              </Link>
              <Link className="secondaryAction routeWorkflowLink" href="/exceptions">
                {textByLocale(locale, "Go to exceptions", "Ir a excepciones")}
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="routePageGrid" aria-label={textByLocale(locale, "Work pages", "Paginas de trabajo")}>
        <article className="routePageCard">
          <p className="eyebrow">{textByLocale(locale, "Execution", "Ejecucion")}</p>
          <h3>{textByLocale(locale, "Visits and location", "Visitas y ubicacion")}</h3>
          <p>{textByLocale(locale, "Open the field user's day organized by province, canton, district, and route.", "Abre la jornada operativa del usuario de campo organizada por provincia, canton, distrito y ruta.")}</p>
          <Link className="primaryAction routeWorkflowLink" href="/routes/day">
            {textByLocale(locale, "Open page", "Abrir pagina")}
          </Link>
        </article>
        <article className="routePageCard">
          <p className="eyebrow">{textByLocale(locale, "Supervision", "Supervision")}</p>
          <h3>{textByLocale(locale, "Route planning", "Planeacion de rutas")}</h3>
          <p>{textByLocale(locale, "Add stops and prepare consignations without mixing this flow with capture work.", "Agrega paradas y prepara consignaciones sin mezclar este flujo con el trabajo de captura.")}</p>
          <Link className="primaryAction routeWorkflowLink" href="/routes/planning">
            {textByLocale(locale, "Open page", "Abrir pagina")}
          </Link>
        </article>
        <article className="routePageCard">
          <p className="eyebrow">{textByLocale(locale, "Evidence", "Evidencia")}</p>
          <h3>{textByLocale(locale, "Evidence", "Evidencia")}</h3>
          <p>{textByLocale(locale, "Review files, upload progress, and recovery from a dedicated screen.", "Revisa archivos, progreso de carga y recuperacion desde una pantalla dedicada.")}</p>
          <Link className="primaryAction routeWorkflowLink" href="/evidence">
            {textByLocale(locale, "Open page", "Abrir pagina")}
          </Link>
        </article>
        <article className="routePageCard">
          <p className="eyebrow">{textByLocale(locale, "Control", "Control")}</p>
          <h3>{textByLocale(locale, "Exceptions", "Excepciones")}</h3>
          <p>{textByLocale(locale, "Manage approvals and device sessions without scrolling to the bottom of routes.", "Gestiona aprobaciones y sesiones de dispositivo sin bajar hasta el final de rutas.")}</p>
          <Link className="primaryAction routeWorkflowLink" href="/exceptions">
            {textByLocale(locale, "Open page", "Abrir pagina")}
          </Link>
        </article>
      </section>
    </AppShell>
  );
}
