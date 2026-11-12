import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const fonte = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "700", "800"] });

export const metadata: Metadata = { title: "Scrull AI", description: "Seu Instagram no automático." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={fonte.className}>{children}</body>
    </html>
  );
}
