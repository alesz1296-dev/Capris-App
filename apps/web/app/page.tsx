import { AppShell } from "./app-shell";
import { DashboardOverview } from "./dashboard-overview";

export default function DashboardPage() {
  return (
    <AppShell
      eyebrow={{ en: "Costa Rica operations", es: "Operaciones Costa Rica" }}
      title={{ en: "Supervisor dashboard", es: "Panel de supervision" }}
      description={{
        en: "Operational metrics, province coverage, route execution, and field evidence in one place.",
        es: "Metricas operativas, cobertura por provincia, ejecucion de rutas y evidencia de campo en un solo lugar."
      }}
    >
      <DashboardOverview />
    </AppShell>
  );
}
