export type GeoPoint = [longitude: number, latitude: number];

export type ProvinceGeoShape = {
  code: string;
  name: string;
  polygon: GeoPoint[];
  label: GeoPoint;
};

export const COSTA_RICA_BOUNDS = {
  minLongitude: -85.95,
  maxLongitude: -82.55,
  minLatitude: 8.0,
  maxLatitude: 11.25
};

export const COSTA_RICA_PROVINCES: ProvinceGeoShape[] = [
  {
    code: "GU",
    name: "Guanacaste",
    polygon: [
      [-85.95, 11.05],
      [-85.2, 11.2],
      [-84.75, 10.85],
      [-84.72, 10.35],
      [-85.0, 9.95],
      [-85.55, 9.75],
      [-85.85, 10.15]
    ],
    label: [-85.42, 10.55]
  },
  {
    code: "AL",
    name: "Alajuela",
    polygon: [
      [-85.2, 11.2],
      [-84.25, 11.05],
      [-83.95, 10.65],
      [-84.05, 10.15],
      [-84.33, 9.95],
      [-84.72, 10.35],
      [-84.75, 10.85]
    ],
    label: [-84.55, 10.62]
  },
  {
    code: "HE",
    name: "Heredia",
    polygon: [
      [-84.25, 11.05],
      [-83.75, 10.95],
      [-83.72, 10.55],
      [-83.92, 10.25],
      [-84.18, 10.12],
      [-84.05, 10.15],
      [-83.95, 10.65]
    ],
    label: [-83.98, 10.57]
  },
  {
    code: "LI",
    name: "Limon",
    polygon: [
      [-83.75, 10.95],
      [-82.65, 10.85],
      [-82.55, 9.65],
      [-82.88, 9.0],
      [-83.32, 8.7],
      [-83.62, 9.22],
      [-83.72, 10.55]
    ],
    label: [-83.05, 9.8]
  },
  {
    code: "SJ",
    name: "San Jose",
    polygon: [
      [-84.33, 9.95],
      [-84.18, 10.12],
      [-83.92, 10.25],
      [-83.72, 10.0],
      [-83.7, 9.62],
      [-84.05, 9.42],
      [-84.38, 9.58]
    ],
    label: [-84.02, 9.82]
  },
  {
    code: "CA",
    name: "Cartago",
    polygon: [
      [-83.92, 10.25],
      [-83.72, 10.55],
      [-83.62, 9.22],
      [-83.82, 9.35],
      [-84.05, 9.42],
      [-83.7, 9.62],
      [-83.72, 10.0]
    ],
    label: [-83.72, 9.85]
  },
  {
    code: "PU",
    name: "Puntarenas",
    polygon: [
      [-85.55, 9.75],
      [-85.0, 9.95],
      [-84.33, 9.95],
      [-84.38, 9.58],
      [-84.05, 9.42],
      [-83.82, 9.35],
      [-83.62, 9.22],
      [-83.32, 8.7],
      [-82.95, 8.35],
      [-83.45, 8.05],
      [-84.05, 8.15],
      [-84.75, 8.55],
      [-85.35, 9.05],
      [-85.78, 9.45]
    ],
    label: [-84.85, 9.15]
  }
];

export function getProvinceGeoShape(code: string, name: string) {
  const normalizedCode = normalizeProvinceKey(code);
  const normalizedName = normalizeProvinceKey(name);
  return COSTA_RICA_PROVINCES.find((province) => normalizeProvinceKey(province.code) === normalizedCode || normalizeProvinceKey(province.name) === normalizedName);
}

export function projectCostaRicaPoint(longitude: number, latitude: number, width: number, height: number) {
  const x = ((longitude - COSTA_RICA_BOUNDS.minLongitude) / (COSTA_RICA_BOUNDS.maxLongitude - COSTA_RICA_BOUNDS.minLongitude)) * width;
  const y = ((COSTA_RICA_BOUNDS.maxLatitude - latitude) / (COSTA_RICA_BOUNDS.maxLatitude - COSTA_RICA_BOUNDS.minLatitude)) * height;
  return { x, y };
}

export function projectPolygon(points: GeoPoint[], width: number, height: number) {
  return points.map(([longitude, latitude]) => {
    const point = projectCostaRicaPoint(longitude, latitude, width, height);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(" ");
}

export function polygonBounds(points: GeoPoint[]) {
  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  return {
    minLongitude: Math.min(...longitudes),
    maxLongitude: Math.max(...longitudes),
    minLatitude: Math.min(...latitudes),
    maxLatitude: Math.max(...latitudes)
  };
}

function normalizeProvinceKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
