import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { Nunito, Lora } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import Providers from "@/components/providers";
import { isClerkEnabled } from "@/lib/clerk-env";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-sans",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meadow Medicine — Health Intake Review",
  description: "Health intake review platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shell = (auth: ReactNode) => (
    <html lang="en" className={`${nunito.variable} ${lora.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        {auth}
        <Toaster />
      </body>
    </html>
  );

  if (!isClerkEnabled()) {
    return shell(
      <Providers>{children}</Providers>,
    );
  }

  return shell(
    <ClerkProvider>
      <Providers>{children}</Providers>
    </ClerkProvider>,
  );
}
