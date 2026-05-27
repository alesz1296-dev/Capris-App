"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const routeLinks = [
  {
    href: "/routes",
    en: "Overview",
    es: "Resumen"
  },
  {
    href: "/routes/day",
    en: "Route day",
    es: "Dia de ruta"
  },
  {
    href: "/routes/planning",
    en: "Planning",
    es: "Planeacion"
  },
  {
    href: "/evidence",
    en: "Evidence",
    es: "Evidencia"
  },
  {
    href: "/exceptions",
    en: "Exceptions",
    es: "Excepciones"
  }
] as const;

export function RouteSectionNav({ locale }: { locale: "en" | "es" }) {
  const pathname = usePathname();

  return (
    <nav className="routeSectionNav" aria-label={locale === "es" ? "Navegacion de rutas" : "Route navigation"}>
      {routeLinks.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? "routeSectionLink routeSectionLinkActive" : "routeSectionLink"}
            aria-current={active ? "page" : undefined}
          >
            {locale === "es" ? link.es : link.en}
          </Link>
        );
      })}
    </nav>
  );
}
