import { AppShell } from "../app-shell";
import { ExceptionsAdmin } from "../exceptions-admin";

export default function ExceptionsPage() {
  return (
    <AppShell
      eyebrow={{ en: "Control and approvals", es: "Control y aprobaciones" }}
      title={{ en: "Exceptions and device access", es: "Excepciones y acceso de dispositivos" }}
      description={{
        en: "Handle field exceptions, approvals, and device access controls from one dedicated page.",
        es: "Gestiona excepciones de campo, aprobaciones y controles de acceso de dispositivos desde una pagina dedicada."
      }}
    >
      <ExceptionsAdmin />
    </AppShell>
  );
}
