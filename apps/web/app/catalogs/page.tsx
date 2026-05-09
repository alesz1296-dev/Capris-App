import { AppShell } from "../app-shell";
import { CatalogAdmin } from "../catalog-admin";

export default function CatalogsPage() {
  return (
    <AppShell
      eyebrow={{ en: "Master data", es: "Datos maestros" }}
      title={{ en: "Catalogs and geography", es: "Catalogos y geografia" }}
      description={{
        en: "Maintain provinces, zones, points of sale, and supporting catalogs from a dedicated page.",
        es: "Mantiene provincias, zonas, puntos de venta y catalogos de apoyo desde una pagina dedicada."
      }}
    >
      <CatalogAdmin />
    </AppShell>
  );
}
