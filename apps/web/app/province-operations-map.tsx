"use client";

import type { EvidenceBootstrap, Locale, PointOfSale, Province, Task, VisitBootstrap } from "@capris/shared";
import { textByLocale } from "./locale-client";
import { formatCoordinates } from "./location-client";

type ProvinceOperationsMapProps = {
  locale: Locale;
  visitBootstrap: VisitBootstrap | null;
  evidenceBootstrap: EvidenceBootstrap | null;
  loading: boolean;
  error: string | null;
};

type Marker = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  tone: "point" | "check_in" | "check_out" | "evidence";
};

export function ProvinceOperationsMap({
  locale,
  visitBootstrap,
  evidenceBootstrap,
  loading,
  error
}: ProvinceOperationsMapProps) {
  const provinces = visitBootstrap?.provinces.filter((province) => province.active) ?? [];

  if (loading) {
    return <p className="feedbackInfo">{textByLocale(locale, "Loading province map...", "Cargando mapa por provincias...")}</p>;
  }

  if (error) {
    return <p className="feedbackError">{error}</p>;
  }

  if (!visitBootstrap || provinces.length === 0) {
    return (
      <p className="feedbackInfo">
        {textByLocale(locale, "Map data will appear once route provinces are available.", "El mapa aparecera cuando existan provincias de ruta disponibles.")}
      </p>
    );
  }

  const taskById = new Map((evidenceBootstrap?.tasks ?? visitBootstrap.tasks).map((task) => [task.id, task]));
  const visitById = new Map((evidenceBootstrap?.visits ?? visitBootstrap.visits).map((visit) => [visit.id, visit]));

  return (
    <section className="catalogSection" aria-label={textByLocale(locale, "Operations map by province", "Mapa operativo por provincia")}>
      <div className="sectionHeading">
        <h2>{textByLocale(locale, "Operations map by province", "Mapa operativo por provincia")}</h2>
        <p className="sectionDescription">
          {textByLocale(
            locale,
            "Each province keeps its own map surface so route coverage, captured GPS, and evidence flow are visible without mixing regions together.",
            "Cada provincia conserva su propia vista de mapa para que la cobertura de ruta, el GPS capturado y el flujo de evidencia se vean sin mezclar regiones."
          )}
        </p>
      </div>

      <div className="provinceMapGrid">
        {provinces.map((province) => {
          const points = visitBootstrap.pointsOfSale.filter(
            (pointOfSale) => pointOfSale.active && pointOfSale.provinceId === province.id && pointOfSale.latitude !== undefined && pointOfSale.longitude !== undefined
          );
          const visits = visitBootstrap.visits.filter((visit) => visit.provinceId === province.id);
          const evidence = (evidenceBootstrap?.evidence ?? []).filter((item) => {
            const linkedVisit = item.visitId ? visitById.get(item.visitId) : undefined;
            const linkedTask = taskById.get(item.taskId);
            return linkedVisit?.provinceId === province.id || linkedTask?.provinceId === province.id;
          });

          const markers = buildProvinceMarkers(locale, points, visits, evidence, taskById);
          const latestVisit = [...visits]
            .filter((visit) => visit.checkedOutLatitude !== undefined || visit.checkedInLatitude !== undefined)
            .sort((left, right) => `${right.checkedOutAt ?? right.checkedInAt ?? ""}`.localeCompare(`${left.checkedOutAt ?? left.checkedInAt ?? ""}`))[0];
          const latestEvidence = [...evidence]
            .filter((item) => item.latitude !== undefined && item.longitude !== undefined)
            .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))[0];

          return (
            <article className="provinceMapCard" key={province.id}>
              <div className="provinceMapHeader">
                <div>
                  <h3>{province.name}</h3>
                  <p>
                    {points.length} {textByLocale(locale, "route stops", "paradas")} · {visits.length} {textByLocale(locale, "visits", "visitas")} · {evidence.length}{" "}
                    {textByLocale(locale, "evidence items", "evidencias")}
                  </p>
                </div>
                <span className="taskBadge">{province.code}</span>
              </div>

              <div className="provinceMapCanvas">
                <svg aria-label={`${province.name} map`} viewBox="0 0 320 220" role="img">
                  <rect x="0" y="0" width="320" height="220" rx="18" ry="18" className="provinceMapBackground" />
                  <g className="provinceMapGridLines">
                    <line x1="24" y1="70" x2="296" y2="70" />
                    <line x1="24" y1="120" x2="296" y2="120" />
                    <line x1="24" y1="170" x2="296" y2="170" />
                    <line x1="92" y1="28" x2="92" y2="192" />
                    <line x1="160" y1="28" x2="160" y2="192" />
                    <line x1="228" y1="28" x2="228" y2="192" />
                  </g>
                  {markers.map((marker) => {
                    const point = projectMarker(markers, marker);
                    return (
                      <g key={marker.id} transform={`translate(${point.x} ${point.y})`}>
                        <title>{marker.label}</title>
                        {marker.tone === "point" ? <circle className={`provinceMarker provinceMarker--${marker.tone}`} cx="0" cy="0" r="6" /> : null}
                        {marker.tone === "check_in" ? <polygon className={`provinceMarker provinceMarker--${marker.tone}`} points="0,-8 8,8 -8,8" /> : null}
                        {marker.tone === "check_out" ? <rect className={`provinceMarker provinceMarker--${marker.tone}`} x="-7" y="-7" width="14" height="14" rx="4" ry="4" /> : null}
                        {marker.tone === "evidence" ? <circle className={`provinceMarker provinceMarker--${marker.tone}`} cx="0" cy="0" r="4" /> : null}
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="provinceMapLegend">
                <span><i className="legendSwatch legendSwatch--point" />{textByLocale(locale, "Point of sale", "Punto de venta")}</span>
                <span><i className="legendSwatch legendSwatch--check-in" />{textByLocale(locale, "Visit check-in", "Entrada de visita")}</span>
                <span><i className="legendSwatch legendSwatch--check-out" />{textByLocale(locale, "Visit check-out", "Salida de visita")}</span>
                <span><i className="legendSwatch legendSwatch--evidence" />{textByLocale(locale, "Evidence GPS", "GPS de evidencia")}</span>
              </div>

              <dl className="taskMetaGrid provinceMapMeta">
                <div>
                  <dt>{textByLocale(locale, "Latest visit GPS", "GPS mas reciente de visita")}</dt>
                  <dd>
                    {latestVisit
                      ? formatCoordinates(
                          latestVisit.checkedOutLatitude ?? latestVisit.checkedInLatitude,
                          latestVisit.checkedOutLongitude ?? latestVisit.checkedInLongitude
                        )
                      : "--"}
                  </dd>
                </div>
                <div>
                  <dt>{textByLocale(locale, "Latest evidence GPS", "GPS mas reciente de evidencia")}</dt>
                  <dd>{latestEvidence ? formatCoordinates(latestEvidence.latitude, latestEvidence.longitude) : "--"}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function buildProvinceMarkers(
  locale: Locale,
  points: PointOfSale[],
  visits: VisitBootstrap["visits"],
  evidence: NonNullable<EvidenceBootstrap>["evidence"],
  taskById: Map<string, Task>
) {
  const markers: Marker[] = [];

  for (const pointOfSale of points) {
    markers.push({
      id: `point-${pointOfSale.id}`,
      latitude: pointOfSale.latitude!,
      longitude: pointOfSale.longitude!,
      tone: "point",
      label: `${pointOfSale.name} · ${formatCoordinates(pointOfSale.latitude, pointOfSale.longitude)}`
    });
  }

  for (const visit of visits) {
    if (visit.checkedInLatitude !== undefined && visit.checkedInLongitude !== undefined) {
      markers.push({
        id: `visit-in-${visit.id}`,
        latitude: visit.checkedInLatitude,
        longitude: visit.checkedInLongitude,
        tone: "check_in",
        label: `${textByLocale(locale, "Check-in", "Entrada")} ${visit.id} · ${formatCoordinates(visit.checkedInLatitude, visit.checkedInLongitude)}`
      });
    }

    if (visit.checkedOutLatitude !== undefined && visit.checkedOutLongitude !== undefined) {
      markers.push({
        id: `visit-out-${visit.id}`,
        latitude: visit.checkedOutLatitude,
        longitude: visit.checkedOutLongitude,
        tone: "check_out",
        label: `${textByLocale(locale, "Check-out", "Salida")} ${visit.id} · ${formatCoordinates(visit.checkedOutLatitude, visit.checkedOutLongitude)}`
      });
    }
  }

  for (const item of evidence) {
    if (item.latitude === undefined || item.longitude === undefined) {
      continue;
    }

    const linkedTask = taskById.get(item.taskId);
    markers.push({
      id: `evidence-${item.id}`,
      latitude: item.latitude,
      longitude: item.longitude,
      tone: "evidence",
      label: `${textByLocale(locale, "Evidence", "Evidencia")} ${linkedTask?.title ?? item.taskId} · ${formatCoordinates(item.latitude, item.longitude)}`
    });
  }

  return markers;
}

function projectMarker(markers: Marker[], marker: Marker) {
  const latitudes = markers.map((item) => item.latitude);
  const longitudes = markers.map((item) => item.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  const x =
    maxLongitude === minLongitude
      ? 160
      : 28 + ((marker.longitude - minLongitude) / (maxLongitude - minLongitude)) * (320 - 56);
  const y =
    maxLatitude === minLatitude
      ? 110
      : 28 + ((maxLatitude - marker.latitude) / (maxLatitude - minLatitude)) * (220 - 56);

  return { x, y };
}
