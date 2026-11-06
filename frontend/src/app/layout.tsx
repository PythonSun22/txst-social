import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";

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
        <Navbar />
        <main className="mx-auto w-full max-w-2xl px-4 py-5">{children}</main>
      </body>
    </html>
  );
}
