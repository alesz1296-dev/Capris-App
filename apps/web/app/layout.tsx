import type { ReactNode } from "react";
import "./globals.css";
import { PwaRegister } from "./pwa-register";

export const metadata = {
  title: "Capris Field Operations",
  description: "Bilingual field operations platform for Costa Rica.",
  applicationName: "Capris Field Operations",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Capris"
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#c5333f"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
