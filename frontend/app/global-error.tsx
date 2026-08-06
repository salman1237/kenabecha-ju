"use client";

/**
 * Last-resort boundary for a throw in the root layout itself.
 *
 * This file *replaces* the root layout when it renders, so it gets none of
 * the app's context: no LanguageProvider (hence English only, not a missed
 * translation), no ThemeProvider, and no globals.css. Everything here is
 * therefore inline-styled and self-contained, including its own <html> and
 * <body>, and it follows the OS colour scheme rather than the app's theme.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "Canvas",
          color: "CanvasText",
          colorScheme: "light dark",
        }}
      >
        <main style={{ maxWidth: "28rem", padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
            The app failed to load
          </h1>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.6, opacity: 0.75, margin: "0 0 1.5rem" }}>
            Something broke before the page could start. Reloading usually fixes it.
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                opacity: 0.6,
                margin: "0 0 1.5rem",
              }}
            >
              {error.digest}
            </p>
          )}
          <button
            onClick={() => unstable_retry()}
            style={{
              border: "1px solid currentColor",
              borderRadius: "0.625rem",
              background: "transparent",
              color: "inherit",
              padding: "0.5rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
