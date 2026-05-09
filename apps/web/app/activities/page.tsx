import { ActivitiesAdmin } from "../activities-admin";
import { AppShell } from "../app-shell";

export default function ActivitiesPage() {
  return (
    <AppShell
      eyebrow={{ en: "Execution records", es: "Registros de ejecucion" }}
      title={{ en: "Activities and exhibitions", es: "Actividades y exhibiciones" }}
      description={{
        en: "Capture activations, exhibitions, and field execution records on a focused page.",
        es: "Captura activaciones, exhibiciones y registros de ejecucion de campo en una pagina enfocada."
      }}
    >
      <ActivitiesAdmin />
    </AppShell>
  );
}
