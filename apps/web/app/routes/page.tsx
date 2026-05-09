import { AppShell } from "../app-shell";
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
      <VisitAdmin />
    </AppShell>
  );
}
