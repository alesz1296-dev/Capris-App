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
  variant?: "dashboard" | "routes";
};

type Marker = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  tone: "point" | "check_in" | "check_out" | "evidence";
};

type ZoneSummary = {
  id: string;
  name: string;
  points: number;
  visits: number;
  evidence: number;
  latestGps: string;
};

export function ProvinceOperationsMap({
  locale,
  visitBootstrap,
  evidenceBootstrap,
  loading,
  error,
  variant = "dashboard"
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
  const activeZones = visitBootstrap.zones.filter((zone) => zone.active);
  const routeStops = visitBootstrap.pointsOfSale.filter((pointOfSale) => pointOfSale.active);
  const capturedVisits = visitBootstrap.visits.filter((visit) => visit.checkedInLatitude !== undefined || visit.checkedOutLatitude !== undefined);
  const capturedEvidence = evidenceBootstrap?.evidence.filter((item) => item.latitude !== undefined && item.longitude !== undefined) ?? [];
  const sectionClassName = variant === "routes" ? "catalogSection routeMapSection" : "catalogSection";

  return (
    <section className={sectionClassName} aria-label={textByLocale(locale, "Province and zone route map", "Mapa de rutas por provincia y zona")}>
      <div className="sectionHeading">
        <p className="eyebrow">{textByLocale(locale, "Costa Rica > Province > Zone", "Costa Rica > Provincia > Zona")}</p>
        <h2>{textByLocale(locale, "Province and zone route map", "Mapa de rutas por provincia y zona")}</h2>
        <p className="sectionDescription">
          {textByLocale(
            locale,
            "Costa Rica is grouped first by province, then by zone, so route coverage, captured GPS, and evidence can be reviewed without mixing operating areas.",
            "Costa Rica se organiza primero por provincia y luego por zona, para revisar cobertura de ruta, GPS capturado y evidencia sin mezclar areas operativas."
          )}
        </p>
      </div>

      {variant === "routes" ? (
        <div className="countryRouteSummary">
          <SummaryStat label={textByLocale(locale, "Country", "Pais")} value="Costa Rica" />
          <SummaryStat label={textByLocale(locale, "Provinces", "Provincias")} value={`${provinces.length}`} />
          <SummaryStat label={textByLocale(locale, "Zones", "Zonas")} value={`${activeZones.length}`} />
          <SummaryStat label={textByLocale(locale, "Route stops", "Paradas")} value={`${routeStops.length}`} />
          <SummaryStat label={textByLocale(locale, "Visits with GPS", "Visitas con GPS")} value={`${capturedVisits.length}`} />
          <SummaryStat label={textByLocale(locale, "Evidence with GPS", "Evidencias con GPS")} value={`${capturedEvidence.length}`} />
        </div>
      ) : null}

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
          const zoneSummaries = buildZoneSummaries(province, visitBootstrap, evidence, taskById);
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
                  <span className="routeHierarchyLabel">Costa Rica / {textByLocale(locale, "Province", "Provincia")}</span>
                  <h3>{province.name}</h3>
                  <p>
                    {points.length} {textByLocale(locale, "route stops", "paradas")} / {visits.length} {textByLocale(locale, "visits", "visitas")} / {evidence.length}{" "}
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

              <div className="provinceZonePanel">
                <strong>{textByLocale(locale, "Zones in this province", "Zonas de esta provincia")}</strong>
                <div className="provinceZoneList">
                  {zoneSummaries.length > 0 ? (
                    zoneSummaries.map((zone) => (
                      <div className="provinceZoneItem" key={zone.id}>
                        <div>
                          <small>{province.name} / {textByLocale(locale, "Zone", "Zona")}</small>
                          <span>{zone.name}</span>
                        </div>
                        <dl>
                          <div>
                            <dt>{textByLocale(locale, "Stops", "Paradas")}</dt>
                            <dd>{zone.points}</dd>
                          </div>
                          <div>
                            <dt>{textByLocale(locale, "Visits", "Visitas")}</dt>
                            <dd>{zone.visits}</dd>
                          </div>
                          <div>
                            <dt>{textByLocale(locale, "Evidence", "Evidencia")}</dt>
                            <dd>{zone.evidence}</dd>
                          </div>
                          <div>
                            <dt>{textByLocale(locale, "Latest GPS", "Ultimo GPS")}</dt>
                            <dd>{zone.latestGps}</dd>
                          </div>
                        </dl>
                      </div>
                    ))
                  ) : (
                    <p className="catalogEmptyState">{textByLocale(locale, "No active zones for this province yet.", "Todavia no hay zonas activas para esta provincia.")}</p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
      label: `${pointOfSale.name} / ${formatCoordinates(pointOfSale.latitude, pointOfSale.longitude)}`
    });
  }

  for (const visit of visits) {
    if (visit.checkedInLatitude !== undefined && visit.checkedInLongitude !== undefined) {
      markers.push({
        id: `visit-in-${visit.id}`,
        latitude: visit.checkedInLatitude,
        longitude: visit.checkedInLongitude,
        tone: "check_in",
        label: `${textByLocale(locale, "Check-in", "Entrada")} ${visit.id} / ${formatCoordinates(visit.checkedInLatitude, visit.checkedInLongitude)}`
      });
    }

    if (visit.checkedOutLatitude !== undefined && visit.checkedOutLongitude !== undefined) {
      markers.push({
        id: `visit-out-${visit.id}`,
        latitude: visit.checkedOutLatitude,
        longitude: visit.checkedOutLongitude,
        tone: "check_out",
        label: `${textByLocale(locale, "Check-out", "Salida")} ${visit.id} / ${formatCoordinates(visit.checkedOutLatitude, visit.checkedOutLongitude)}`
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
      label: `${textByLocale(locale, "Evidence", "Evidencia")} ${linkedTask?.title ?? item.taskId} / ${formatCoordinates(item.latitude, item.longitude)}`
    });
  }

  return markers;
}

function buildZoneSummaries(
  province: Province,
  visitBootstrap: VisitBootstrap,
  evidence: NonNullable<EvidenceBootstrap>["evidence"],
  taskById: Map<string, Task>
) {
  const activeZones = visitBootstrap.zones.filter((zone) => zone.active && zone.provinceId === province.id);

  return activeZones.map((zone) => {
    const points = visitBootstrap.pointsOfSale.filter((pointOfSale) => pointOfSale.active && pointOfSale.zoneId === zone.id);
    const visits = visitBootstrap.visits.filter((visit) => visit.zoneId === zone.id);
    const zoneEvidence = evidence.filter((item) => {
      const linkedTask = taskById.get(item.taskId);
      return linkedTask?.zoneId === zone.id || visits.some((visit) => visit.id === item.visitId);
    });
    const latestVisit = [...visits]
      .filter((visit) => visit.checkedOutLatitude !== undefined || visit.checkedInLatitude !== undefined)
      .sort((left, right) => `${right.checkedOutAt ?? right.checkedInAt ?? ""}`.localeCompare(`${left.checkedOutAt ?? left.checkedInAt ?? ""}`))[0];
    const latestEvidence = [...zoneEvidence]
      .filter((item) => item.latitude !== undefined && item.longitude !== undefined)
      .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))[0];

    return {
      id: zone.id,
      name: zone.name,
      points: points.length,
      visits: visits.length,
      evidence: zoneEvidence.length,
      latestGps:
        latestEvidence
          ? formatCoordinates(latestEvidence.latitude, latestEvidence.longitude)
          : latestVisit
            ? formatCoordinates(
                latestVisit.checkedOutLatitude ?? latestVisit.checkedInLatitude,
                latestVisit.checkedOutLongitude ?? latestVisit.checkedInLongitude
              )
            : "--"
    } satisfies ZoneSummary;
  });
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
