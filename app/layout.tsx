import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme/provider";
import { I18nProvider } from "@/lib/i18n/provider";
import { SettingsWidget } from "@/components/SettingsWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Loamia — Brand GPT",
  description: "AI Marketing OS for advertising agencies and brands",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("loamia.theme")?.value;
  const localeCookie = cookieStore.get("loamia.locale")?.value;
  const theme = themeCookie === "light" ? "light" : "dark";
  const locale = localeCookie === "en" ? "en" : "zh";

  return (
    <html
      lang={locale === "zh" ? "zh-TW" : "en"}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ${theme}`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeProvider initialTheme={theme}>
          <I18nProvider initialLocale={locale}>
            {children}
            <SettingsWidget />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
