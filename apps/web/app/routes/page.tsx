import { AppShell } from "../app-shell";
import { EvidenceAdmin } from "../evidence-admin";
import { ExceptionsAdmin } from "../exceptions-admin";
import { StaticCostaRicaMap } from "../province-operations-map";
import { SupervisorRouteWorkspace } from "../supervisor-route-workspace";
import { VisitAdmin } from "../visit-admin";

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
      <section className="routeCommandCenter">
        <div>
          <p className="eyebrow">Ruta diaria</p>
          <h2>Mapa, visitas, evidencia, excepciones y GPS en un solo lugar</h2>
          <p>
            Esta pagina es la base operativa para usuarios de campo. Supervisores y admins tambien ven herramientas de planeacion cuando su rol lo permite.
          </p>
        </div>
        <nav aria-label="Herramientas de ruta">
          <a href="#route-map">Mapa</a>
          <a href="#routes">Visitas y GPS</a>
          <a href="#route-evidence">Evidencia</a>
          <a href="#route-exceptions">Excepciones</a>
        </nav>
      </section>

      <section className="catalogSection routeWorkflowSection">
        <div className="sectionHeading">
          <p className="eyebrow">Flujo diario de ruta</p>
          <h2>Herramientas de campo dentro de rutas</h2>
          <p className="sectionDescription">
            Evidencia y excepciones siguen existiendo con todas sus funciones, pero ahora se entienden como pasos del trabajo de ruta y no como destinos principales separados.
          </p>
        </div>
        <div className="routeWorkflowGrid">
          <article className="routeWorkflowCard">
            <span className="taskBadge">1</span>
            <h3>Ejecutar visita</h3>
            <p>Controla check-in, check-out, GPS, provincias, zonas y seguimiento del recorrido del dia.</p>
            <div className="taskCardActions">
              <a className="primaryAction routeWorkflowLink" href="#routes">
                Ir al control de ruta
              </a>
            </div>
          </article>
          <article className="routeWorkflowCard">
            <span className="taskBadge">2</span>
            <h3>Capturar evidencia</h3>
            <p>Sube fotos, revisa coordenadas GPS, estado de carga y recuperacion de material capturado durante la ruta.</p>
            <div className="taskCardActions">
              <a className="secondaryAction routeWorkflowLink" href="#route-evidence">
                Abrir evidencia
              </a>
            </div>
          </article>
          <article className="routeWorkflowCard">
            <span className="taskBadge">3</span>
            <h3>Resolver excepciones</h3>
            <p>Atiende bloqueos de campo, faltantes de GPS, revisiones y controles de acceso del dispositivo desde el contexto operativo.</p>
            <div className="taskCardActions">
              <a className="secondaryAction routeWorkflowLink" href="#route-exceptions">
                Abrir excepciones
              </a>
            </div>
          </article>
        </div>
      </section>
      <section className="catalogSection routeMapSection" id="route-map">
        <div className="sectionHeading">
          <p className="eyebrow">Costa Rica &gt; Provincia &gt; Zona</p>
          <h2>Mapa base de rutas</h2>
          <p className="sectionDescription">
            El mapa de Costa Rica vive dentro de Rutas y se muestra antes de cualquier carga operativa, para que siempre tengamos una referencia visual inmediata.
          </p>
        </div>
        <StaticCostaRicaMap locale="es" />
      </section>
      <SupervisorRouteWorkspace />
      <VisitAdmin />
      <section className="routeEmbeddedWorkspace" id="route-evidence">
        <details open>
          <summary>
            <span>Evidencia de ruta</span>
            <small>Fotos, GPS, estado de carga y recuperacion</small>
          </summary>
          <EvidenceAdmin />
        </details>
      </section>
      <section className="routeEmbeddedWorkspace" id="route-exceptions">
        <details>
          <summary>
            <span>Excepciones de ruta</span>
            <small>GPS faltante, tienda cerrada, carga fallida y bloqueos</small>
          </summary>
          <ExceptionsAdmin />
        </details>
      </section>
    </AppShell>
  );
}
