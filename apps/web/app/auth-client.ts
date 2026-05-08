"use client";

import type { AuthResponse } from "@capris/shared";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
export const AUTH_STORAGE_KEY = "capris_auth_tokens";
export const AUTH_CHANGED_EVENT = "capris-auth-changed";

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

export function loadStoredTokens(): StoredTokens | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = localStorage.getItem(AUTH_STORAGE_KEY);
    return value ? (JSON.parse(value) as StoredTokens) : null;
  } catch {
    return null;
  }
}

export function persistTokens(tokens: StoredTokens) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens));
  emitAuthChanged();
}

export function clearStoredTokens() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  emitAuthChanged();
}

export function subscribeToAuthChanges(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => callback();
  window.addEventListener(AUTH_CHANGED_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export async function authenticatedFetch(input: string, init: RequestInit = {}) {
  const tokens = loadStoredTokens();
  if (!tokens) {
    throw new Error("Sign in with Google to access authenticated data.");
  }

  let response = await fetch(input, withAccessToken(init, tokens.accessToken));
  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshStoredSession(tokens.refreshToken);
  if (!refreshed) {
    clearStoredTokens();
    throw new Error("Session expired. Sign in again.");
  }

  response = await fetch(input, withAccessToken(init, refreshed.accessToken));
  return response;
}

export async function refreshStoredSession(refreshToken: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
    const payload = (await response.json()) as AuthResponse & { message?: string };
    if (!response.ok) {
      throw new Error(payload.message ?? "Unable to refresh session.");
    }

    const nextTokens = {
      accessToken: payload.tokens.accessToken,
      refreshToken: payload.tokens.refreshToken
    };
    persistTokens(nextTokens);
    return nextTokens;
  } catch {
    return null;
  }
}

function withAccessToken(init: RequestInit, accessToken: string): RequestInit {
  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  return {
    ...init,
    headers
  };
}

function emitAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}
