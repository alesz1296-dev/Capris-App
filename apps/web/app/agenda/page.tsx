import { AgendaAdmin } from "../agenda-admin";
import { AppShell } from "../app-shell";

export default function AgendaPage() {
  return (
    <AppShell
      eyebrow={{ en: "Planning and follow-up", es: "Planificacion y seguimiento" }}
      title={{ en: "Agenda and client requests", es: "Agenda y solicitudes de cliente" }}
      description={{
        en: "Shared scheduling, workload windows, and client follow-up separated from the rest of operations.",
        es: "Programacion compartida, ventanas de carga de trabajo y seguimiento de clientes separados del resto de la operacion."
      }}
    >
      <AgendaAdmin />
    </AppShell>
  );
}
