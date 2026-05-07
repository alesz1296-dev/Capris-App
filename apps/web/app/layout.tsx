import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Capris Field Operations",
  description: "Bilingual field operations platform for Costa Rica."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

