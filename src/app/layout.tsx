import type { Metadata, Viewport } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import "./globals.css";
import { DomainSwitcherProvider } from "@/components/DomainSwitcherContext";
import { DomainSwitcherButton } from "@/components/DomainSwitcherButton";
import { DomainSwitcherSheet } from "@/components/DomainSwitcherSheet";

const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const publicSans = Public_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Wealth OS",
  description: "Finanzas personales automatizadas",
  appleWebApp: {
    capable: true,
    title: "Wealth OS",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b5c42",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="es" className={`${fraunces.variable} ${publicSans.variable}`}>
        <body>
          <DomainSwitcherProvider>
            <div className="page">
              <div className="topbar">
                <div className="brand">
                  <DomainSwitcherButton />
                </div>
                <UserButton />
              </div>
              {children}
            </div>
            <DomainSwitcherSheet />
          </DomainSwitcherProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
