import type { Metadata } from "next";
import { Newsreader, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex-sans",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "CleanTech Desk — Research Assistant",
  description:
    "Ask about clean technology, renewable energy, and climate policy, grounded in 20,000+ cleantech news articles with inline citations.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${newsreader.variable} ${plexSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
