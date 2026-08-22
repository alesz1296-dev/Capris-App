"use client";

import { AuthPanel } from "../auth-panel";
import { textByLocale, useAppLocale } from "../locale-client";

export default function LoginPage() {
  const locale = useAppLocale();

  return (
    <main className="loginPage">
      <section className="loginHero">
        <p className="eyebrow">Capris Costa Rica</p>
        <h1>{textByLocale(locale, "Sign in to Capris", "Ingresar a Capris")}</h1>
        <p className="pageLead">
          {textByLocale(
            locale,
            "Sign in with email and password, or create a field user account to enter the app.",
            "Inicia sesion con correo y contrasena, o crea una cuenta de usuario de campo para entrar a la aplicacion."
          )}
        </p>
      </section>
      <section className="loginCard" aria-label={textByLocale(locale, "Sign in", "Inicio de sesion")}>
        <AuthPanel />
      </section>
    </main>
  );
}
