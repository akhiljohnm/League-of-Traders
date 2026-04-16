import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Rajdhani } from "next/font/google";
import "./globals.css";
import { DerivTickerProvider } from "@/providers/DerivTickerProvider";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rajdhani",
});

export const metadata: Metadata = {
  title: "League of Traders | Co-Op PvE Trading Game",
  description:
    "Turn trading into a team sport. 5 players, 5 minutes, live markets. Powered by Deriv API.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} ${rajdhani.variable} antialiased`}
      >
        <DerivTickerProvider>
          {children}
        </DerivTickerProvider>
      </body>
    </html>
  );
}
