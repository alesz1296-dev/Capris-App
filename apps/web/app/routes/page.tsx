import Link from "next/link";
import { AppShell } from "../app-shell";
import { RouteSectionNav } from "../route-section-nav";

export default function RoutesPage() {
  return (
    <AppShell
      eyebrow={{ en: "Route execution", es: "Ejecucion de ruta" }}
      title={{ en: "Visits and route control", es: "Visitas y control de ruta" }}
      description={{
        en: "Run route stops, check-ins, check-outs, and GPS traces without mixing them into the full dashboard.",
        es: "Ejecuta paradas de ruta, entradas, salidas y trazas GPS sin mezclarlas con todo el panel principal."
      }}
    >
      <RouteSectionNav locale="es" />

      <section className="routeCommandCenter">
        <div>
          <p className="eyebrow">Ruta diaria</p>
          <h2>Un espacio mas limpio para moverse por funciones</h2>
          <p>
            Rutas ahora funciona como un punto de entrada. Cada bloque importante tiene su propia pagina para que en movil no haga falta recorrer una pantalla larguisima.
          </p>
        </div>
        <nav aria-label="Herramientas de ruta">
          <Link href="/routes/day">Dia de ruta</Link>
          <Link href="/routes/planning">Planeacion</Link>
          <Link href="/evidence">Evidencia</Link>
          <Link href="/exceptions">Excepciones</Link>
        </nav>
      </section>

      <section className="catalogSection routeWorkflowSection">
        <div className="sectionHeading">
          <p className="eyebrow">Funciones separadas</p>
          <h2>Menos scroll, mas contexto por pantalla</h2>
          <p className="sectionDescription">
            Cada pagina conserva las herramientas existentes, pero ahora agrupadas por objetivo para que el trabajo diario se sienta mas claro en desktop y mucho mas ligero en movil.
          </p>
        </div>
        <div className="routeWorkflowGrid">
          <article className="routeWorkflowCard">
            <span className="taskBadge">1</span>
            <h3>Dia de ruta</h3>
            <p>Mapa operativo, visitas, check-in, check-out y GPS en una sola pantalla enfocada en ejecucion.</p>
            <div className="taskCardActions">
              <Link className="primaryAction routeWorkflowLink" href="/routes/day">
                Abrir dia de ruta
              </Link>
            </div>
          </article>
          <article className="routeWorkflowCard">
            <span className="taskBadge">2</span>
            <h3>Planeacion</h3>
            <p>Paradas compartidas y consignaciones en una pagina separada, con accesos directos a tareas y agenda.</p>
            <div className="taskCardActions">
              <Link className="secondaryAction routeWorkflowLink" href="/routes/planning">
                Abrir planeacion
              </Link>
            </div>
          </article>
          <article className="routeWorkflowCard">
            <span className="taskBadge">3</span>
            <h3>Evidencia y excepciones</h3>
            <p>Revision de cargas, miniaturas, bloqueos y aprobaciones sin quedar enterradas al final de la pagina de rutas.</p>
            <div className="taskCardActions">
              <Link className="secondaryAction routeWorkflowLink" href="/evidence">
                Ir a evidencia
              </Link>
              <Link className="secondaryAction routeWorkflowLink" href="/exceptions">
                Ir a excepciones
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="routePageGrid" aria-label="Paginas de trabajo">
        <article className="routePageCard">
          <p className="eyebrow">Ejecucion</p>
          <h3>Visitas, mapa y GPS</h3>
          <p>Abre la jornada operativa del usuario de campo con todo lo necesario para moverse por la ruta.</p>
          <Link className="primaryAction routeWorkflowLink" href="/routes/day">
            Abrir pagina
          </Link>
        </article>
        <article className="routePageCard">
          <p className="eyebrow">Supervision</p>
          <h3>Planeacion de rutas</h3>
          <p>Agrega paradas y prepara consignaciones sin mezclar este flujo con el trabajo de captura.</p>
          <Link className="primaryAction routeWorkflowLink" href="/routes/planning">
            Abrir pagina
          </Link>
        </article>
        <article className="routePageCard">
          <p className="eyebrow">Soporte</p>
          <h3>Evidencia</h3>
          <p>Revisa medios, progreso de carga y recuperacion desde una pantalla dedicada.</p>
          <Link className="primaryAction routeWorkflowLink" href="/evidence">
            Abrir pagina
          </Link>
        </article>
        <article className="routePageCard">
          <p className="eyebrow">Control</p>
          <h3>Excepciones</h3>
          <p>Gestiona aprobaciones y sesiones de dispositivo sin bajar hasta el final de rutas.</p>
          <Link className="primaryAction routeWorkflowLink" href="/exceptions">
            Abrir pagina
          </Link>
        </article>
      </section>
    </AppShell>
  );
}
