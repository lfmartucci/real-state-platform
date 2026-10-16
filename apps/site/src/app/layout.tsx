import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "M.C. Vieira Imóveis",
  description: "Imóveis selecionados em Embu-Guaçu e região.",
};

// Tipos explícitos em vez de LayoutProps<"/">: o `tsc --noEmit` roda sem os tipos que só o build gera.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
