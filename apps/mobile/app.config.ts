import type { ExpoConfig } from "expo/config";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
const appVariant = process.env.EXPO_PUBLIC_APP_VARIANT ?? "development";

const config: ExpoConfig = {
  name: "Capris Field",
  slug: "capris-field",
  scheme: "capris",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  plugins: [
    "expo-dev-client",
    "expo-secure-store",
    [
      "expo-location",
      {
        locationWhenInUsePermission: "Capris captures GPS during visit check-ins, check-outs, and evidence capture."
      }
    ]
  ],
  extra: {
    apiBaseUrl,
    appVariant
  },
  ios: {
    supportsTablet: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription: "Capris captures GPS during visit check-ins, check-outs, and evidence capture."
    },
    bundleIdentifier:
      appVariant === "staging" ? "com.capris.field.staging" : "com.capris.field.dev"
  },
  android: {
    package: appVariant === "staging" ? "com.capris.field.staging" : "com.capris.field.dev",
    permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "CAMERA"]
  }
};

export default config;
