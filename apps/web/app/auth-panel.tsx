"use client";

import { useEffect, useRef, useState } from "react";
import { t, type AuthProfileResponse, type AuthResponse } from "@capris/shared";
import {
  API_BASE_URL,
  GOOGLE_CLIENT_ID,
  clearStoredTokens,
  loadStoredTokens,
  persistTokens,
  refreshStoredSession,
  subscribeToAuthChanges,
  type StoredTokens
} from "./auth-client";
import { persistPreferredLocale, textByLocale, useAppLocale } from "./locale-client";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            config: Record<string, string | number>
          ) => void;
        };
      };
    };
  }
}

export function AuthPanel() {
  const locale = useAppLocale();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const [profile, setProfile] = useState<AuthProfileResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadStoredTokens();
    if (stored) {
      setTokens(stored);
      void loadProfile(stored.accessToken, stored.refreshToken);
    }

    return subscribeToAuthChanges(() => {
      const nextTokens = loadStoredTokens();
      setTokens(nextTokens);
      if (!nextTokens) {
        setProfile(null);
        return;
      }

      void loadProfile(nextTokens.accessToken, nextTokens.refreshToken);
    });
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) {
      return;
    }

    let cancelled = false;
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-identity="true"]');

    const initialize = () => {
      if (cancelled || !window.google || !googleButtonRef.current) {
        return;
      }

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: ({ credential }) => {
          void signInWithGoogle(credential);
        }
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signin_with",
        width: 220
      });
    };

    if (window.google) {
      initialize();
      return () => {
        cancelled = true;
      };
    }

    const script =
      existingScript ??
      Object.assign(document.createElement("script"), {
        src: "https://accounts.google.com/gsi/client",
        async: true,
        defer: true
      });

    script.dataset.googleIdentity = "true";
    script.addEventListener("load", initialize, { once: true });

    if (!existingScript) {
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      script.removeEventListener("load", initialize);
    };
  }, []);

  async function signInWithGoogle(idToken: string) {
    setStatus(t(locale, "auth.signIn"));
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          deviceName: locale === "es" ? "Capris Web" : "Capris Web"
        })
      });

      const payload = (await response.json()) as AuthResponse & { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? textByLocale(locale, "Google sign-in failed.", "Fallo el inicio de sesion con Google."));
      }

      const nextTokens = {
        accessToken: payload.tokens.accessToken,
        refreshToken: payload.tokens.refreshToken
      };
      persistTokens(nextTokens);
      setTokens(nextTokens);
      setProfile({
        user: payload.user,
        session: payload.session
      });
      persistPreferredLocale(payload.user.locale);
      setStatus(textByLocale(locale, "Signed in.", "Sesion iniciada."));
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : textByLocale(locale, "Google sign-in failed.", "Fallo el inicio de sesion con Google."));
      setStatus(null);
    }
  }

  async function loadProfile(accessToken: string, refreshToken: string) {
    setError(null);

    try {
      let response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (response.status === 401) {
        const refreshed = await refreshStoredSession(refreshToken);
        if (!refreshed) {
          clearSessionState();
          return;
        }

        response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${refreshed.accessToken}`
          }
        });
      }

      const payload = (await response.json()) as AuthProfileResponse & { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? textByLocale(locale, "Unable to load profile.", "No se pudo cargar el perfil."));
      }

      setProfile(payload);
      persistPreferredLocale(payload.user.locale);
      setStatus(textByLocale(locale, "Signed in and active.", "Sesion activa."));
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : textByLocale(locale, "Unable to load profile.", "No se pudo cargar el perfil."));
    }
  }

  async function signOut() {
    const currentTokens = tokens;
    clearSessionState();
    setStatus(textByLocale(locale, "Signed out.", "Sesion cerrada."));

    if (!currentTokens) {
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/auth/sign-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: currentTokens.refreshToken })
      });
    } catch {
      // Best effort sign-out; local session is already cleared.
    }
  }

  function clearSessionState() {
    clearStoredTokens();
    setTokens(null);
    setProfile(null);
  }

  return (
    <div className="authPanel">
      <div className="authPanelHeader">
        <strong>{profile ? t(locale, "auth.sessionActive") : t(locale, "auth.signIn")}</strong>
        {tokens ? (
          <button className="secondaryAction" type="button" onClick={() => void signOut()}>
            {t(locale, "auth.signOut")}
          </button>
        ) : null}
      </div>

      {profile ? (
        <div className="authIdentity">
          <div>
            <p className="authLabel">{t(locale, "auth.signedInAs")}</p>
            <p className="authValue">
              {profile.user.name} / {profile.user.email}
            </p>
            <p className="authMeta">
              {profile.user.role} / {profile.session.provider} / {profile.session.deviceName ?? textByLocale(locale, "Browser", "Navegador")}
            </p>
          </div>
          {profile.user.avatarUrl ? <img alt={profile.user.name} className="authAvatar" src={profile.user.avatarUrl} /> : null}
        </div>
      ) : GOOGLE_CLIENT_ID ? (
        <div className="authSignInBlock">
          <p className="sectionDescription">{t(locale, "auth.loginRequired")}</p>
          <div ref={googleButtonRef} />
        </div>
      ) : (
        <p className="sectionDescription">{t(locale, "auth.googleUnavailable")}</p>
      )}

      {status ? <p className="feedbackInfo authFeedback">{status}</p> : null}
      {error ? <p className="feedbackError authFeedback">{error}</p> : null}
    </div>
  );
}

