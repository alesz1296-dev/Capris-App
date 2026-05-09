import Link from "next/link";
import { AuthPanel } from "../auth-panel";

export default function LoginPage() {
  return (
    <main className="loginPage">
      <section className="loginHero">
        <p className="eyebrow">Capris Costa Rica</p>
        <h1>Ingresar a Capris</h1>
        <p className="pageLead">
          Crea una cuenta con correo y contrasena, o inicia sesion con una cuenta existente. Google OAuth puede agregarse despues sin cambiar el flujo JWT.
        </p>
        <Link className="secondaryAction" href="/">
          Volver al panel
        </Link>
      </section>
      <section className="loginCard" aria-label="Inicio de sesion">
        <AuthPanel />
      </section>
    </main>
  );
}
