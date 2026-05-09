import { AccessOverview, AppShell } from "../app-shell";

export default function AccessPage() {
  return (
    <AppShell
      eyebrow={{ en: "Identity and access", es: "Identidad y acceso" }}
      title={{ en: "Organizations, roles, and scope", es: "Organizaciones, roles y alcance" }}
      description={{
        en: "Review role boundaries, supervisor scope examples, and access structure on a clean page.",
        es: "Revisa limites de roles, ejemplos de alcance de supervision y estructura de acceso en una pagina limpia."
      }}
    >
      <AccessOverview />
    </AppShell>
  );
}
