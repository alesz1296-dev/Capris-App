import { AppShell } from "../app-shell";
import { PerformanceAdmin } from "../performance-admin";

export default function PerformancePage() {
  return (
    <AppShell
      eyebrow={{ en: "Business analytics", es: "Analitica de negocio" }}
      title={{ en: "Field performance", es: "Desempeno de campo" }}
      description={{
        en: "Supervisor and admin view for task execution, scorecards, and operational performance.",
        es: "Vista de supervision y administracion para ejecucion de tareas, scorecards y desempeno operativo."
      }}
    >
      <PerformanceAdmin />
    </AppShell>
  );
}

