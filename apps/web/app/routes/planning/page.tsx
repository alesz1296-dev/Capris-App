import Link from "next/link";
import { AppShell } from "../../app-shell";
import { RouteSectionNav } from "../../route-section-nav";
import { SupervisorRouteWorkspace } from "../../supervisor-route-workspace";

export default function RoutePlanningPage() {
  return (
    <AppShell
      eyebrow={{ en: "Supervisor planning", es: "Planeacion de supervision" }}
      title={{ en: "Route planning", es: "Planeacion de rutas" }}
      description={{
        en: "Shared route-stop planning and consignation preparation, with task and agenda work kept on their own pages.",
        es: "Planeacion de paradas compartidas y preparacion de consignaciones, con tareas y agenda en sus propias paginas."
      }}
    >
      <RouteSectionNav locale="es" />
      <section className="routePlanningLinks" aria-label="Accesos de planeacion">
        <Link className="secondaryAction" href="/tasks">
          Ir a tareas
        </Link>
        <Link className="secondaryAction" href="/agenda">
          Ir a agenda
        </Link>
      </section>
      <SupervisorRouteWorkspace />
    </AppShell>
  );
}
