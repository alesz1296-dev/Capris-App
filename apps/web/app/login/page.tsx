import { AuthPanel } from "../auth-panel";

export default function LoginPage() {
  return (
    <main className="loginPage">
      <section className="loginHero">
        <p className="eyebrow">Capris Costa Rica</p>
        <h1>Ingresar a Capris</h1>
        <p className="pageLead">
          Inicia sesion con correo y contrasena, o crea una cuenta de usuario de campo para entrar a la aplicacion.
        </p>
      </section>
      <section className="loginCard" aria-label="Inicio de sesion">
        <AuthPanel />
      </section>
    </main>
  );
}
