import { AppShell } from "../../app-shell";
import { RouteSectionNav } from "../../route-section-nav";
import { VisitAdmin } from "../../visit-admin";

export default function RouteDayPage() {
  return (
    <AppShell
      eyebrow={{ en: "Route execution", es: "Ejecucion de ruta" }}
      title={{ en: "Route day and visits", es: "Dia de ruta y visitas" }}
      description={{
        en: "Focused route execution for map review, visits, check-ins, check-outs, and live GPS.",
        es: "Ejecucion enfocada para revisar mapa, visitas, entradas, salidas y GPS en vivo."
      }}
    >
      <RouteSectionNav locale="es" />
      <VisitAdmin />
    </AppShell>
  );
}
