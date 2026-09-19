import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InstallAll — Video Downloader",
  description: "Baixe vídeos e áudios de links compatíveis de forma simples.",
  robots: { index: true, follow: true }
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" suppressHydrationWarning><body>{children}</body></html>;
}
