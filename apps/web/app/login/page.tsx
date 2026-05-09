import { AuthPanel } from "../auth-panel";

export default function LoginPage() {
  return (
    <main className="loginPage">
      <section className="loginHero">
        <p className="eyebrow">Capris Costa Rica</p>
        <h1>Ingresar a Capris</h1>
        <p className="pageLead">
          Inicia sesión con correo y contraseña, o crea una cuenta de usuario de campo para entrar a la aplicación.
        </p>
      </section>
      <section className="loginCard" aria-label="Inicio de sesión">
        <AuthPanel />
      </section>
    </main>
  );
}
