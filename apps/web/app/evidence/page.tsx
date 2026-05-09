import { AppShell } from "../app-shell";
import { EvidenceAdmin } from "../evidence-admin";

export default function EvidencePage() {
  return (
    <AppShell
      eyebrow={{ en: "Field proof", es: "Prueba de campo" }}
      title={{ en: "Evidence and upload control", es: "Evidencia y control de cargas" }}
      description={{
        en: "Review captured media, GPS coordinates, upload state, and recovery actions in one workflow.",
        es: "Revisa medios capturados, coordenadas GPS, estado de carga y acciones de recuperacion en un solo flujo."
      }}
    >
      <EvidenceAdmin />
    </AppShell>
  );
}
