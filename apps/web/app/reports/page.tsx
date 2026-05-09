import { AppShell } from "../app-shell";
import { ReportsAdmin } from "../reports-admin";

export default function ReportsPage() {
  return (
    <AppShell
      eyebrow={{ en: "Reporting", es: "Reporteria" }}
      title={{ en: "Reports and exports", es: "Reportes y exportaciones" }}
      description={{
        en: "Operational snapshots, exports, and reporting workflows now live on their own page.",
        es: "Los cortes operativos, exportaciones y flujos de reporteria ahora viven en su propia pagina."
      }}
    >
      <ReportsAdmin />
    </AppShell>
  );
}
