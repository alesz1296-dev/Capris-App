"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@capris/shared";

type DeferredPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstall({ locale }: { locale: Locale }) {
  const [promptEvent, setPromptEvent] = useState<DeferredPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone;

    setShowIosHint(isIos && !isStandalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as DeferredPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  async function handleInstall() {
    if (!promptEvent) {
      return;
    }

    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => undefined);
    setPromptEvent(null);
  }

  if (!promptEvent && !showIosHint) {
    return null;
  }

  return (
    <div className="installPrompt" role="status" aria-live="polite">
      <div>
        <p className="installPromptTitle">{locale === "es" ? "Instalar app" : "Install app"}</p>
        <p className="installPromptCopy">
          {promptEvent
            ? locale === "es"
              ? "Abre Capris desde tu pantalla de inicio para una experiencia movil mas limpia."
              : "Open Capris from your home screen for a cleaner mobile workspace."
            : locale === "es"
              ? "Usa Compartir en Safari > Agregar a pantalla de inicio para instalar Capris en iPhone."
              : "Use Safari Share > Add to Home Screen to install Capris on iPhone."}
        </p>
      </div>
      {promptEvent ? (
        <button className="secondaryAction" type="button" onClick={() => void handleInstall()}>
          {locale === "es" ? "Instalar" : "Install"}
        </button>
      ) : null}
    </div>
  );
}
