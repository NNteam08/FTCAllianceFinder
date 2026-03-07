import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "FTC Alliance Finder",
  description: "Find the perfect alliance partner for FTC | Найди идеального партнера для альянса в FTC",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <body className={manrope.className}>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}




