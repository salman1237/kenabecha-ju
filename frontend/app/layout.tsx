import type { Metadata } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Footer } from "@/components/layout/Footer";
import { MotionProvider } from "@/components/layout/MotionProvider";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Navbar } from "@/components/layout/Navbar";
import { PageTransition } from "@/components/layout/PageTransition";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { NavigationProvider } from "@/context/NavigationContext";
import { SkipLinkLabel } from "@/components/layout/SkipLinkLabel";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { FALLBACK_NAVIGATION } from "@/lib/navigation";
import { SERVER_API_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import type { Navigation } from "@/types/api";

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
  // metadataBase makes every relative OG/canonical URL below resolve to an
  // absolute one. Without it Next warns and social crawlers, which never
  // resolve relative URLs, silently get nothing.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Jahangirnagar University Marketplace`,
    // Pages set only their own title; this supplies the suffix.
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Jahangirnagar University",
    "JU marketplace",
    "student marketplace",
    "buy and sell",
    "campus shop",
    "textbooks",
    "জাহাঙ্গীরনগর বিশ্ববিদ্যালয়",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Jahangirnagar University Marketplace`,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US",
    alternateLocale: ["bn_BD"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Jahangirnagar University Marketplace`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

/** Never let a navigation failure take down every page. An API blip would
 *  otherwise leave the whole site with no way to get anywhere, which is far
 *  worse than slightly stale menus. */
async function loadNavigation(): Promise<Navigation> {
  try {
    const res = await fetch(`${SERVER_API_URL}/navigation`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return FALLBACK_NAVIGATION;
    return (await res.json()) as Navigation;
  } catch {
    return FALLBACK_NAVIGATION;
  }
}

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
  const navigation = await loadNavigation();

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
              <NavigationProvider navigation={navigation}>
              <AuthProvider>
                {/* Visible only on keyboard focus — lets keyboard and screen
                    reader users jump past the nav on every page. */}
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-[var(--shadow-soft-lg)]"
                >
                  <SkipLinkLabel />
                </a>
                <Navbar />
                <main id="main-content" tabIndex={-1} className="flex-1">
                  <PageTransition>{children}</PageTransition>
                </main>
                <Footer />
                {/* Fixed bar would otherwise cover the last ~3.5rem of every
                    page on mobile; this reserves that space. */}
                <div aria-hidden className="h-14 md:hidden" />
                <MobileBottomNav />
                <Toaster />
              </AuthProvider>
              </NavigationProvider>
            </LanguageProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
