import { AppShell } from "../app-shell";
import { ImportsAdmin } from "../imports-admin";

export default function ImportsPage() {
  return (
    <AppShell
      eyebrow={{ en: "Data intake", es: "Ingreso de datos" }}
      title={{ en: "Imports and reconciliation", es: "Importaciones y conciliacion" }}
      description={{
        en: "Bring in operational files and review import status without leaving the import workspace.",
        es: "Ingresa archivos operativos y revisa el estado de importacion sin salir del espacio de importaciones."
      }}
    >
      <ImportsAdmin />
    </AppShell>
  );
}
