"use client";

import type { EvidenceBootstrap, Locale, PointOfSale, Province, Task, VisitBootstrap } from "@capris/shared";
import { COSTA_RICA_PROVINCES, getProvinceGeoShape, polygonBounds, projectCostaRicaPoint, projectPolygon, type ProvinceGeoShape } from "./costa-rica-geography";
import { textByLocale } from "./locale-client";
import { formatCoordinates } from "./location-client";

type ProvinceOperationsMapProps = {
  locale: Locale;
  visitBootstrap: VisitBootstrap | null;
  evidenceBootstrap: EvidenceBootstrap | null;
  loading: boolean;
  error: string | null;
  variant?: "dashboard" | "routes";
  liveLocation?: LiveLocation | null;
};

type Marker = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  tone: "point" | "check_in" | "check_out" | "evidence" | "live";
};

export type LiveLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  capturedAt: string;
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
  variant = "dashboard",
  liveLocation
}: ProvinceOperationsMapProps) {
  const provinces = visitBootstrap?.provinces.filter((province) => province.active) ?? [];

  if (loading) {
    return <p className="feedbackInfo">{textByLocale(locale, "Loading province map...", "Cargando mapa por provincias...")}</p>;
  }

  if (error) {
    return (
      <section className="catalogSection routeMapSection" aria-label={textByLocale(locale, "Province and zone route map", "Mapa de rutas por provincia y zona")}>
        <div className="sectionHeading">
          <p className="eyebrow">{textByLocale(locale, "Costa Rica > Province > Zone", "Costa Rica > Provincia > Zona")}</p>
          <h2>{textByLocale(locale, "Province and zone route map", "Mapa de rutas por provincia y zona")}</h2>
          <p className="sectionDescription">
            {textByLocale(
              locale,
              "The base map is available. Operational route, zone, and GPS data will appear after the API data loads.",
              "El mapa base esta disponible. Los datos operativos de rutas, zonas y GPS apareceran cuando carguen los datos de la API."
            )}
          </p>
        </div>
        <StaticCostaRicaMap locale={locale} />
        <p className="feedbackError">{error}</p>
      </section>
    );
  }

  if (!visitBootstrap || provinces.length === 0) {
    return (
      <section className="catalogSection routeMapSection" aria-label={textByLocale(locale, "Province and zone route map", "Mapa de rutas por provincia y zona")}>
        <div className="sectionHeading">
          <p className="eyebrow">{textByLocale(locale, "Costa Rica > Province > Zone", "Costa Rica > Provincia > Zona")}</p>
          <h2>{textByLocale(locale, "Province and zone route map", "Mapa de rutas por provincia y zona")}</h2>
          <p className="sectionDescription">
            {textByLocale(
              locale,
              "No province or zone catalog data was returned by the API yet. Check that the API has seeded or imported provinces, zones, and points of sale.",
              "La API todavia no devolvio catalogos de provincias o zonas. Verifica que existan provincias, zonas y puntos de venta importados o sembrados."
            )}
          </p>
        </div>
        <StaticCostaRicaMap locale={locale} />
        <div className="routeMapEmpty">
          <strong>{textByLocale(locale, "Map waiting for route geography", "Mapa esperando geografia de rutas")}</strong>
          <span>
            {textByLocale(
              locale,
              "Expected data: provinces, zones, points of sale, and GPS captures from visit check-in/check-out or evidence uploads.",
              "Datos esperados: provincias, zonas, puntos de venta y GPS capturado desde entrada/salida de visita o carga de evidencia."
            )}
          </span>
        </div>
      </section>
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
        <>
          <div className="countryRouteSummary">
            <SummaryStat label={textByLocale(locale, "Country", "Pais")} value="Costa Rica" />
            <SummaryStat label={textByLocale(locale, "Provinces", "Provincias")} value={`${provinces.length}`} />
            <SummaryStat label={textByLocale(locale, "Zones", "Zonas")} value={`${activeZones.length}`} />
            <SummaryStat label={textByLocale(locale, "Route stops", "Paradas")} value={`${routeStops.length}`} />
            <SummaryStat label={textByLocale(locale, "Visits with GPS", "Visitas con GPS")} value={`${capturedVisits.length}`} />
            <SummaryStat label={textByLocale(locale, "Evidence with GPS", "Evidencias con GPS")} value={`${capturedEvidence.length}`} />
          </div>
          <CostaRicaRouteMap
            locale={locale}
            provinces={provinces}
            visitBootstrap={visitBootstrap}
            evidenceBootstrap={evidenceBootstrap}
            taskById={taskById}
            visitById={visitById}
            liveLocation={liveLocation}
          />
        </>
      ) : null}

      <div className="provinceMapGrid">
        {provinces.map((province) => {
          const points = visitBootstrap.pointsOfSale.filter(
            (pointOfSale) => pointOfSale.active && pointOfSale.provinceId === province.id
          );
          const geoPoints = points.filter((pointOfSale) => pointOfSale.latitude !== undefined && pointOfSale.longitude !== undefined);
          const visits = visitBootstrap.visits.filter((visit) => visit.provinceId === province.id);
          const evidence = (evidenceBootstrap?.evidence ?? []).filter((item) => {
            const linkedVisit = item.visitId ? visitById.get(item.visitId) : undefined;
            const linkedTask = taskById.get(item.taskId);
            return linkedVisit?.provinceId === province.id || linkedTask?.provinceId === province.id;
          });

          const markers = buildProvinceMarkers(locale, geoPoints, visits, evidence, taskById);
          const zoneSummaries = buildZoneSummaries(province, visitBootstrap, evidence, taskById);
          const provinceShape = getProvinceGeoShape(province.code, province.name);
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
                {provinceShape ? (
                  <ProvinceGeoMap locale={locale} province={province} shape={provinceShape} markers={markers} zones={zoneSummaries} />
                ) : (
                  <FallbackProvinceCanvas locale={locale} province={province} markers={markers} />
                )}
              </div>

              <div className="provinceMapLegend">
                <span><i className="legendSwatch legendSwatch--point" />{textByLocale(locale, "Point of sale", "Punto de venta")}</span>
                <span><i className="legendSwatch legendSwatch--check-in" />{textByLocale(locale, "Visit check-in", "Entrada de visita")}</span>
                <span><i className="legendSwatch legendSwatch--check-out" />{textByLocale(locale, "Visit check-out", "Salida de visita")}</span>
                <span><i className="legendSwatch legendSwatch--evidence" />{textByLocale(locale, "Evidence GPS", "GPS de evidencia")}</span>
              </div>

              <dl className="taskMetaGrid provinceMapMeta">
                <div>
                  <dt>{textByLocale(locale, "GPS-enabled stops", "Paradas con GPS")}</dt>
                  <dd>{geoPoints.length} / {points.length}</dd>
                </div>
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

function StaticCostaRicaMap({ locale }: { locale: Locale }) {
  const width = 760;
  const height = 430;

  return (
    <article className="countryGeoMapCard">
      <div className="provinceMapHeader">
        <div>
          <span className="routeHierarchyLabel">Costa Rica / {textByLocale(locale, "Base map", "Mapa base")}</span>
          <h3>{textByLocale(locale, "Costa Rica provinces", "Provincias de Costa Rica")}</h3>
          <p>
            {textByLocale(
              locale,
              "This base layer renders even before route catalogs, zone assignments, or GPS captures are available.",
              "Esta capa base se renderiza incluso antes de que existan catalogos de ruta, asignaciones de zona o capturas GPS."
            )}
          </p>
        </div>
      </div>
      <svg className="countryGeoMap" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={textByLocale(locale, "Costa Rica province base map", "Mapa base de provincias de Costa Rica")}>
        <rect className="countryGeoOcean" x="0" y="0" width={width} height={height} rx="24" />
        {COSTA_RICA_PROVINCES.map((shape) => {
          const label = projectCostaRicaPoint(shape.label[0], shape.label[1], width, height);
          return (
            <g key={shape.code}>
              <polygon className="countryProvince countryProvince--active" points={projectPolygon(shape.polygon, width, height)} />
              <text className="countryProvinceLabel" x={label.x} y={label.y}>
                {shape.code}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="provinceMapLegend">
        <span><i className="legendSwatch legendSwatch--province" />{textByLocale(locale, "Province boundary", "Limite provincial")}</span>
      </div>
    </article>
  );
}

function CostaRicaRouteMap({
  locale,
  provinces,
  visitBootstrap,
  evidenceBootstrap,
  taskById,
  visitById,
  liveLocation
}: {
  locale: Locale;
  provinces: Province[];
  visitBootstrap: VisitBootstrap;
  evidenceBootstrap: EvidenceBootstrap | null;
  taskById: Map<string, Task>;
  visitById: Map<string, VisitBootstrap["visits"][number]>;
  liveLocation?: LiveLocation | null;
}) {
  const width = 760;
  const height = 430;
  const activeProvinceCodes = new Set(provinces.map((province) => getProvinceGeoShape(province.code, province.name)?.code).filter(Boolean));
  const provinceByGeoCode = new Map(
    provinces
      .map((province) => {
        const shape = getProvinceGeoShape(province.code, province.name);
        return shape ? ([shape.code, province] as const) : null;
      })
      .filter((item): item is readonly [string, Province] => item !== null)
  );
  const allMarkers = provinces.flatMap((province) => {
    const provinceShape = getProvinceGeoShape(province.code, province.name);
    if (!provinceShape) {
      return [];
    }

    const points = visitBootstrap.pointsOfSale.filter(
      (pointOfSale) => pointOfSale.active && pointOfSale.provinceId === province.id && pointOfSale.latitude !== undefined && pointOfSale.longitude !== undefined
    );
    const visits = visitBootstrap.visits.filter((visit) => visit.provinceId === province.id);
    const evidence = (evidenceBootstrap?.evidence ?? []).filter((item) => {
      const linkedVisit = item.visitId ? visitById.get(item.visitId) : undefined;
      const linkedTask = taskById.get(item.taskId);
      return linkedVisit?.provinceId === province.id || linkedTask?.provinceId === province.id;
    });

    return buildProvinceMarkers(locale, points, visits, evidence, taskById);
  });
  const liveMarker: Marker | null = liveLocation
    ? {
        id: "live-device",
        latitude: liveLocation.latitude,
        longitude: liveLocation.longitude,
        tone: "live",
        label: `${textByLocale(locale, "Live device GPS", "GPS real del dispositivo")} / ${formatCoordinates(liveLocation.latitude, liveLocation.longitude)}`
      }
    : null;
  const mapMarkers = liveMarker ? [...allMarkers, liveMarker] : allMarkers;

  return (
    <article className="countryGeoMapCard">
      <div className="provinceMapHeader">
        <div>
          <span className="routeHierarchyLabel">Costa Rica / {textByLocale(locale, "Geographic map", "Mapa geografico")}</span>
          <h3>{textByLocale(locale, "Province boundary overview", "Vista geografica por provincias")}</h3>
          <p>
            {textByLocale(
              locale,
              "Province polygons are rendered locally; operational zones are drawn inside each province and GPS captures are plotted by coordinates.",
              "Los poligonos de provincia se renderizan localmente; las zonas operativas se dibujan dentro de cada provincia y el GPS se ubica por coordenadas."
            )}
          </p>
        </div>
      </div>
      <svg className="countryGeoMap" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={textByLocale(locale, "Costa Rica province and GPS map", "Mapa de provincias y GPS de Costa Rica")}>
        <rect className="countryGeoOcean" x="0" y="0" width={width} height={height} rx="24" />
        {COSTA_RICA_PROVINCES.map((shape) => {
          const province = provinceByGeoCode.get(shape.code);
          const zones = province ? visitBootstrap.zones.filter((zone) => zone.active && zone.provinceId === province.id) : [];
          return (
            <g key={shape.code}>
              <polygon
                className={activeProvinceCodes.has(shape.code) ? "countryProvince countryProvince--active" : "countryProvince"}
                points={projectPolygon(shape.polygon, width, height)}
              />
              {province ? <ZoneOverlay shape={shape} zoneCount={zones.length} width={width} height={height} clipId={`country-${shape.code}`} /> : null}
              <text className="countryProvinceLabel" x={projectCostaRicaPoint(shape.label[0], shape.label[1], width, height).x} y={projectCostaRicaPoint(shape.label[0], shape.label[1], width, height).y}>
                {province?.code ?? shape.code}
              </text>
            </g>
          );
        })}
        {mapMarkers.map((marker) => {
          const point = projectCostaRicaPoint(marker.longitude, marker.latitude, width, height);
          return <MapMarker key={`country-${marker.id}`} marker={marker} x={point.x} y={point.y} compact />;
        })}
      </svg>
      <div className="provinceMapLegend">
        <span><i className="legendSwatch legendSwatch--province" />{textByLocale(locale, "Province boundary", "Limite provincial")}</span>
        <span><i className="legendSwatch legendSwatch--zone" />{textByLocale(locale, "Operational zone area", "Area de zona operativa")}</span>
        <span><i className="legendSwatch legendSwatch--point" />{textByLocale(locale, "Point of sale GPS", "GPS de punto de venta")}</span>
        <span><i className="legendSwatch legendSwatch--check-in" />{textByLocale(locale, "Visit GPS", "GPS de visita")}</span>
        <span><i className="legendSwatch legendSwatch--evidence" />{textByLocale(locale, "Evidence GPS", "GPS de evidencia")}</span>
        <span><i className="legendSwatch legendSwatch--live" />{textByLocale(locale, "Live device GPS", "GPS real del dispositivo")}</span>
      </div>
    </article>
  );
}

function ProvinceGeoMap({ locale, province, shape, markers, zones }: { locale: Locale; province: Province; shape: ProvinceGeoShape; markers: Marker[]; zones: ZoneSummary[] }) {
  const width = 320;
  const height = 220;
  const localBounds = polygonBounds(shape.polygon);
  const projectedPolygon = shape.polygon.map(([longitude, latitude]) => {
    const point = projectLocalGeoPoint(longitude, latitude, localBounds, width, height);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg aria-label={`${province.name} map`} viewBox={`0 0 ${width} ${height}`} role="img">
      <rect x="0" y="0" width={width} height={height} rx="18" ry="18" className="provinceMapBackground" />
      <polygon className="provinceGeoShape" points={projectedPolygon} />
      <ZoneOverlay shape={shape} zoneCount={zones.length} width={width} height={height} clipId={`province-${province.id}`} local />
      <text className="provinceGeoLabel" x="24" y="32">{province.name}</text>
      {markers.map((marker) => {
        const point = projectLocalGeoPoint(marker.longitude, marker.latitude, localBounds, width, height);
        return <MapMarker key={marker.id} marker={marker} x={point.x} y={point.y} />;
      })}
      {markers.length === 0 ? (
        <text className="provinceMapEmptyText" x="160" y="112" textAnchor="middle">
          {textByLocale(locale, "No GPS points yet", "Sin puntos GPS aun")}
        </text>
      ) : null}
    </svg>
  );
}

function FallbackProvinceCanvas({ locale, province, markers }: { locale: Locale; province: Province; markers: Marker[] }) {
  return (
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
        return <MapMarker key={marker.id} marker={marker} x={point.x} y={point.y} />;
      })}
      {markers.length === 0 ? (
        <text className="provinceMapEmptyText" x="160" y="112" textAnchor="middle">
          {textByLocale(locale, "No GPS points yet", "Sin puntos GPS aun")}
        </text>
      ) : null}
    </svg>
  );
}

function ZoneOverlay({ shape, zoneCount, width, height, clipId, local = false }: { shape: ProvinceGeoShape; zoneCount: number; width: number; height: number; clipId: string; local?: boolean }) {
  if (zoneCount === 0) {
    return null;
  }

  const bounds = polygonBounds(shape.polygon);
  const polygonPoints = local
    ? shape.polygon.map(([longitude, latitude]) => {
        const point = projectLocalGeoPoint(longitude, latitude, bounds, width, height);
        return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
      }).join(" ")
    : projectPolygon(shape.polygon, width, height);
  const stripeWidth = width / Math.max(zoneCount, 1);

  return (
    <g>
      <clipPath id={clipId}>
        <polygon points={polygonPoints} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {Array.from({ length: zoneCount }).map((_, index) => (
          <rect
            className={index % 2 === 0 ? "provinceZoneArea provinceZoneArea--primary" : "provinceZoneArea provinceZoneArea--secondary"}
            height={height}
            key={`${clipId}-${index}`}
            width={stripeWidth + 2}
            x={index * stripeWidth}
            y="0"
          />
        ))}
      </g>
    </g>
  );
}

function MapMarker({ marker, x, y, compact = false }: { marker: Marker; x: number; y: number; compact?: boolean }) {
  const radius = compact ? 4 : 6;

  return (
    <g transform={`translate(${x} ${y})`}>
      <title>{marker.label}</title>
      {marker.tone === "point" ? <circle className={`provinceMarker provinceMarker--${marker.tone}`} cx="0" cy="0" r={radius} /> : null}
      {marker.tone === "check_in" ? <polygon className={`provinceMarker provinceMarker--${marker.tone}`} points={`0,-${radius + 2} ${radius + 2},${radius + 2} -${radius + 2},${radius + 2}`} /> : null}
      {marker.tone === "check_out" ? <rect className={`provinceMarker provinceMarker--${marker.tone}`} x={-radius} y={-radius} width={radius * 2} height={radius * 2} rx="4" ry="4" /> : null}
      {marker.tone === "evidence" ? <circle className={`provinceMarker provinceMarker--${marker.tone}`} cx="0" cy="0" r={Math.max(3, radius - 1)} /> : null}
      {marker.tone === "live" ? (
        <>
          <circle className="provinceMarkerLiveHalo" cx="0" cy="0" r={radius + 7} />
          <circle className={`provinceMarker provinceMarker--${marker.tone}`} cx="0" cy="0" r={radius + 1} />
        </>
      ) : null}
    </g>
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

function projectLocalGeoPoint(
  longitude: number,
  latitude: number,
  bounds: { minLongitude: number; maxLongitude: number; minLatitude: number; maxLatitude: number },
  width: number,
  height: number
) {
  const horizontalRange = bounds.maxLongitude - bounds.minLongitude || 1;
  const verticalRange = bounds.maxLatitude - bounds.minLatitude || 1;
  const padding = 24;
  const x = padding + ((longitude - bounds.minLongitude) / horizontalRange) * (width - padding * 2);
  const y = padding + ((bounds.maxLatitude - latitude) / verticalRange) * (height - padding * 2);
  return { x, y };
}
