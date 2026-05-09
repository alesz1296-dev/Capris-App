"use client";

import type { Locale, PointOfSale } from "@capris/shared";
import { textByLocale } from "./locale-client";

const FALLBACK_LATITUDE = 9.9186;
const FALLBACK_LONGITUDE = -84.1397;

export type CapturedWebLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  capturedAt: string;
  source: "device" | "point_of_sale" | "fallback";
  label: string;
};

export async function resolveWebCoordinates(locale: Locale, pointOfSale?: PointOfSale): Promise<CapturedWebLocation> {
  const timestamp = new Date().toISOString();

  if (typeof window !== "undefined" && "geolocation" in navigator) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 15000,
          timeout: 12000
        });
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
        capturedAt: timestamp,
        source: "device",
        label: textByLocale(locale, "Live browser GPS", "GPS real del navegador")
      };
    } catch {
      // Fall through to linked route coordinates below.
    }
  }

  if (pointOfSale?.latitude !== undefined && pointOfSale.longitude !== undefined) {
    return {
      latitude: pointOfSale.latitude,
      longitude: pointOfSale.longitude,
      capturedAt: timestamp,
      source: "point_of_sale",
      label: textByLocale(
        locale,
        `Linked point of sale${pointOfSale.name ? `: ${pointOfSale.name}` : ""}`,
        `Punto de venta vinculado${pointOfSale.name ? `: ${pointOfSale.name}` : ""}`
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

export function formatCoordinates(latitude?: number, longitude?: number) {
  if (latitude === undefined || longitude === undefined) {
    return "--";
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}
