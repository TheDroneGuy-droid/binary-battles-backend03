import type { Metadata } from "next";
import { Roboto_Condensed } from "next/font/google";
import "./globals.css";

const robotoCondensed = Roboto_Condensed({
  weight: ["300", "400", "700"],
  subsets: ["latin"],
  variable: "--font-roboto-condensed",
});

export const metadata: Metadata = {
  title: "Binary Battles 0.3",
  description: "Modern Coding Competition Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={robotoCondensed.variable}>{children}</body>
    </html>
  );
}
