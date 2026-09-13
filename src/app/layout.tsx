import type { Metadata } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import "./globals.css";
import { BottomNav, TopNav } from "@/components/Nav";

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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="es" className={`${fraunces.variable} ${publicSans.variable}`}>
        <body>
          <div className="page">
            <div className="topbar">
              <div className="brand">
                <span className="brand-mark serif">Wealth OS</span>
              </div>
              <UserButton />
            </div>
            <TopNav />
            {children}
            <BottomNav />
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
