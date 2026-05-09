"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
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
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [emailForm, setEmailForm] = useState({
    name: "",
    email: "",
    password: ""
  });

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

  async function submitEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(authMode === "login" ? textByLocale(locale, "Signing in...", "Iniciando sesion...") : textByLocale(locale, "Creating account...", "Creando cuenta..."));
    setError(null);

    try {
      const endpoint = authMode === "login" ? "login" : "register";
      const response = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: authMode === "register" ? emailForm.name : undefined,
          email: emailForm.email,
          password: emailForm.password,
          locale,
          deviceName: "Capris Web"
        })
      });

      const payload = (await response.json()) as AuthResponse & { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? textByLocale(locale, "Email sign-in failed.", "Fallo el inicio de sesion con correo."));
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
      setEmailForm({ name: "", email: "", password: "" });
      setStatus(authMode === "login" ? textByLocale(locale, "Signed in.", "Sesion iniciada.") : textByLocale(locale, "Account created.", "Cuenta creada."));
    } catch (emailAuthError) {
      setError(emailAuthError instanceof Error ? emailAuthError.message : textByLocale(locale, "Email sign-in failed.", "Fallo el inicio de sesion con correo."));
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
      ) : (
        <div className="authSignInBlock">
          <p className="sectionDescription">
            {textByLocale(locale, "Sign in with email or create a field user account.", "Inicia sesion con correo o crea una cuenta de usuario de campo.")}
          </p>
          <div className="authModeSwitch" aria-label={textByLocale(locale, "Authentication mode", "Modo de autenticacion")}>
            <button aria-pressed={authMode === "login"} type="button" onClick={() => setAuthMode("login")}>
              {textByLocale(locale, "Login", "Ingresar")}
            </button>
            <button aria-pressed={authMode === "register"} type="button" onClick={() => setAuthMode("register")}>
              {textByLocale(locale, "Create account", "Crear cuenta")}
            </button>
          </div>
          <form className="authEmailForm" onSubmit={(event) => void submitEmailAuth(event)}>
            {authMode === "register" ? (
              <label>
                <span>{textByLocale(locale, "Name", "Nombre")}</span>
                <input
                  autoComplete="name"
                  minLength={2}
                  required
                  value={emailForm.name}
                  onChange={(event) => setEmailForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
            ) : null}
            <label>
              <span>{textByLocale(locale, "Email", "Correo")}</span>
              <input
                autoComplete="email"
                required
                type="email"
                value={emailForm.email}
                onChange={(event) => setEmailForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label>
              <span>{textByLocale(locale, "Password", "Contrasena")}</span>
              <input
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                minLength={8}
                required
                type="password"
                value={emailForm.password}
                onChange={(event) => setEmailForm((current) => ({ ...current, password: event.target.value }))}
              />
            </label>
            <button className="primaryAction" type="submit">
              {authMode === "login" ? textByLocale(locale, "Sign in", "Ingresar") : textByLocale(locale, "Create account", "Crear cuenta")}
            </button>
          </form>
          {GOOGLE_CLIENT_ID ? (
            <>
              <p className="authDivider">{textByLocale(locale, "or continue with Google", "o continua con Google")}</p>
              <div ref={googleButtonRef} />
            </>
          ) : null}
        </div>
      )}

      {status ? <p className="feedbackInfo authFeedback">{status}</p> : null}
      {error ? <p className="feedbackError authFeedback">{error}</p> : null}
    </div>
  );
}

