import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
});

const assistant = localFont({
  src: "../../public/Assistant/Assistant-VariableFont_wght.ttf",
  variable: "--font-body",
  weight: "200 800",
});

const mplus1 = localFont({
  src: "../../public/M_PLUS_1/MPLUS1-VariableFont_wght.ttf",
  variable: "--font-heading",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Vova Egorov TOP 500",
  description: "A curated collection of 500 essential albums",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${assistant.variable} ${mplus1.variable} ${geistMono.variable} antialiased`}
        style={{ fontFamily: "var(--font-body), sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
