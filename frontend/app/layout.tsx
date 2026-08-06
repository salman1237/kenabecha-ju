import type { Metadata } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Footer } from "@/components/layout/Footer";
import { MotionProvider } from "@/components/layout/MotionProvider";
import { Navbar } from "@/components/layout/Navbar";
import { PageTransition } from "@/components/layout/PageTransition";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Inter has no Bengali coverage, so without this every Bangla string falls
// back to whatever the OS happens to supply — which on Windows is usually a
// mismatched, badly-spaced face. Loaded on both locales because Bangla shows
// up in English mode too (shop names, listing titles written by students).
const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-bengali",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KenaBecha JU — Jahangirnagar University Marketplace",
  description: "Buy, sell, and run shops within the Jahangirnagar University community.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read on the server so the first paint is already in the right language
  // and <html lang> is correct — a client-side read would mean both a
  // hydration mismatch and a flash of English.
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${notoBengali.variable} font-sans h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <MotionProvider>
            <LanguageProvider initialLocale={locale}>
              <AuthProvider>
                {/* Visible only on keyboard focus — lets keyboard and screen
                    reader users jump past the nav on every page. */}
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-[var(--shadow-soft-lg)]"
                >
                  Skip to content
                </a>
                <Navbar />
                <main id="main-content" tabIndex={-1} className="flex-1">
                  <PageTransition>{children}</PageTransition>
                </main>
                <Footer />
                <Toaster />
              </AuthProvider>
            </LanguageProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
