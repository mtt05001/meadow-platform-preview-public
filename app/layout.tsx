import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Nunito, Lora } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import Providers from "@/components/providers";
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
  return (
    <ClerkProvider>
      <html lang="en" className={`${nunito.variable} ${lora.variable} ${geistMono.variable}`}>
        <body className="antialiased">
          <Providers>
            {children}
          </Providers>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
