import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Broco Finance",
  description: "Control financiero operativo para Broco Solutions",
  icons: { icon: "/Favicon.ico", shortcut: "/Favicon.ico", apple: "/Favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans antialiased bg-gray-100 text-gray-900`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
