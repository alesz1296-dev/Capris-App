import { AppShell } from "../../app-shell";
import { RouteSectionNav } from "../../route-section-nav";
import { VisitAdmin } from "../../visit-admin";

export default function RouteDayPage() {
  return (
    <AppShell
      eyebrow={{ en: "Route execution", es: "Ejecucion de ruta" }}
      title={{ en: "Route day and visits", es: "Dia de ruta y visitas" }}
      description={{
        en: "Focused route execution for visits, check-ins, check-outs, and administrative location review.",
        es: "Ejecucion enfocada para revisar visitas, entradas, salidas y ubicacion administrativa."
      }}
    >
      <RouteSectionNav locale="es" />
      <VisitAdmin />
    </AppShell>
  );
}
