import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import type { AuthProfileResponse, AuthResponse } from "@capris/shared";
import { clearAuthSession, loadAuthSession, saveAuthSession } from "./offline-store";

WebBrowser.maybeCompleteAuthSession();

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export type StoredMobileSession = {
  accessToken: string;
  refreshToken: string;
  profile?: AuthProfileResponse;
};

export const googleDiscovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke"
};

export function createGoogleAuthConfig() {
  return {
    clientId: GOOGLE_CLIENT_ID,
    responseType: AuthSession.ResponseType.IdToken,
    scopes: ["openid", "profile", "email"],
    redirectUri: AuthSession.makeRedirectUri({
      scheme: "capris"
    }),
    extraParams: {
      nonce: "capris-mobile"
    }
  } satisfies AuthSession.AuthRequestConfig;
}

export async function exchangeGoogleIdToken(idToken: string) {
  const response = await fetch(`${API_BASE_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken,
      deviceName: "Capris Mobile"
    })
  });

  const payload = (await response.json()) as AuthResponse & { message?: string };
  if (!response.ok) {
    throw new Error(payload.message ?? "Mobile Google sign-in failed.");
  }

  const stored: StoredMobileSession = {
    accessToken: payload.tokens.accessToken,
    refreshToken: payload.tokens.refreshToken,
    profile: {
      user: payload.user,
      session: payload.session
    }
  };
  await saveAuthSession(stored);
  return stored;
}

export async function loadStoredMobileSession() {
  return loadAuthSession<StoredMobileSession>();
}

export async function clearStoredMobileSession() {
  await clearAuthSession();
}

export async function refreshMobileSession(refreshToken: string) {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  const payload = (await response.json()) as AuthResponse & { message?: string };
  if (!response.ok) {
    throw new Error(payload.message ?? "Unable to refresh mobile session.");
  }

  const stored: StoredMobileSession = {
    accessToken: payload.tokens.accessToken,
    refreshToken: payload.tokens.refreshToken,
    profile: {
      user: payload.user,
      session: payload.session
    }
  };

  await saveAuthSession(stored);
  return stored;
}

export async function signOutMobileSession(refreshToken?: string) {
  if (refreshToken) {
    try {
      await fetch(`${API_BASE_URL}/auth/sign-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });
    } catch {
      // Best effort remote sign-out.
    }
  }

  await clearStoredMobileSession();
}

export async function authenticatedMobileFetch(input: string, init: RequestInit = {}) {
  const session = await loadStoredMobileSession();
  if (!session) {
    throw new Error("Sign in with Google on mobile before syncing with the API.");
  }

  let response = await fetch(input, withAccessToken(init, session.accessToken));
  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshMobileSession(session.refreshToken);
  response = await fetch(input, withAccessToken(init, refreshed.accessToken));
  return response;
}

function withAccessToken(init: RequestInit, accessToken: string): RequestInit {
  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  return {
    ...init,
    headers
  };
}
