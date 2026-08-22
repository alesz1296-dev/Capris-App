import { AppShell } from "../app-shell";
import { ObservabilityAdmin } from "../observability-admin";

export default function ObservabilityPage() {
  return (
    <AppShell
      eyebrow={{ en: "Developer / SRE", es: "Developer / SRE" }}
      title={{ en: "App observability", es: "Observabilidad de la app" }}
      description={{
        en: "Runtime health and operational counters kept separate from business performance dashboards.",
        es: "Salud de runtime y contadores operativos separados de los paneles de desempeno de negocio."
      }}
    >
      <ObservabilityAdmin />
    </AppShell>
  );
}

