import { type Locale } from "@capris/shared";
import * as Location from "expo-location";

const FALLBACK_LATITUDE = 9.9186;
const FALLBACK_LONGITUDE = -84.1397;

export type CapturedDeviceLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  capturedAt: string;
  source: "device" | "point_of_sale" | "fallback";
  label: string;
};

type ResolveDeviceLocationOptions = {
  locale: Locale;
  pointOfSaleName?: string;
  pointOfSaleLatitude?: number;
  pointOfSaleLongitude?: number;
};

export async function resolveDeviceCoordinates({
  locale,
  pointOfSaleName,
  pointOfSaleLatitude,
  pointOfSaleLongitude
}: ResolveDeviceLocationOptions): Promise<CapturedDeviceLocation> {
  const timestamp = new Date().toISOString();

  try {
    const existingPermission = await Location.getForegroundPermissionsAsync();
    const permission =
      existingPermission.status === "granted" ? existingPermission : await Location.requestForegroundPermissionsAsync();

    if (permission.granted) {
      const lastKnownPosition = await Location.getLastKnownPositionAsync();
      const position =
        lastKnownPosition ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        }));

      if (position) {
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          capturedAt: timestamp,
          source: "device",
          label: textByLocale(locale, "Live device GPS", "GPS real del dispositivo")
        };
      }
    }
  } catch {
    // Fall back to linked route coordinates below.
  }

  if (pointOfSaleLatitude !== undefined && pointOfSaleLongitude !== undefined) {
    return {
      latitude: pointOfSaleLatitude,
      longitude: pointOfSaleLongitude,
      capturedAt: timestamp,
      source: "point_of_sale",
      label: textByLocale(
        locale,
        `Linked point of sale${pointOfSaleName ? `: ${pointOfSaleName}` : ""}`,
        `Punto de venta vinculado${pointOfSaleName ? `: ${pointOfSaleName}` : ""}`
      )
    };
  }

  return {
    latitude: FALLBACK_LATITUDE,
    longitude: FALLBACK_LONGITUDE,
    capturedAt: timestamp,
    source: "fallback",
    label: textByLocale(locale, "Fallback GPS", "GPS de respaldo")
  };
}

function textByLocale(locale: Locale, english: string, spanish: string) {
  return locale === "es" ? spanish : english;
}
