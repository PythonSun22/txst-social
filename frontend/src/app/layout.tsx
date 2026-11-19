import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import AppShell from "@/components/layout/AppShell";
import SpacesProvider from "@/components/spaces/SpacesProvider";

export const metadata: Metadata = {
  title: "TXST Lynx",
  description: "A social platform for Texas State University students.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen">
        <SpacesProvider>
          <Navbar />
          <AppShell>{children}</AppShell>
        </SpacesProvider>
      </body>
    </html>
  );
}
