"use client";

import Script from "next/script";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { loginWithGoogle } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
        };
      };
    };
    __googleInitialized?: boolean;
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export function GoogleSignInButton({ next, onError }: { next: string; onError?: (message: string) => void }) {
  const { setUser } = useAuth();
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  // The GIS script tag persists across client-side navigations (next/script dedupes by
  // src), so on a second mount it's often already loaded by the time this component
  // mounts — check directly rather than only waiting for a load event.
  const [scriptReady, setScriptReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.google?.accounts?.id)
  );

  const latest = useRef({ next, onError, setUser, router });
  useEffect(() => {
    latest.current = { next, onError, setUser, router };
  });

  useEffect(() => {
    if (!scriptReady || !GOOGLE_CLIENT_ID || !containerRef.current || !window.google) return;

    // Re-initializing on every mount (e.g. toggling between /login and /signup) breaks
    // every renderButton() call after the first — initialize once per tab, guarded on
    // `window` rather than a module-level variable since Next's per-route chunking can
    // give each page its own module scope despite sharing the same window.google. The
    // callback reads from a ref so it always uses whichever mount's next/handlers are
    // current, regardless of which one actually ran initialize().
    if (!window.__googleInitialized) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            const user = await loginWithGoogle(response.credential);
            latest.current.setUser(user);
            latest.current.router.push(latest.current.next);
          } catch (err) {
            latest.current.onError?.(err instanceof ApiError ? err.message : "Google sign-in failed. Please try again.");
          }
        },
      });
      window.__googleInitialized = true;
    }

    const container = containerRef.current;
    container.innerHTML = "";

    // Google's renderButton() isn't safe to call twice back-to-back on the same
    // container — confirmed by testing that it silently produces an empty container
    // when that happens. React 19/Next dev Strict Mode double-invokes every effect
    // (mount -> cleanup -> mount) to surface exactly this kind of non-idempotent side
    // effect; deferring the actual call by a tick lets the phantom invocation's cleanup
    // cancel it before it ever calls Google's SDK, leaving only the real mount's call.
    const timer = setTimeout(() => {
      window.google!.accounts.id.renderButton(container, {
        theme: resolvedTheme === "dark" ? "filled_black" : "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: 320,
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [scriptReady, resolvedTheme]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} className="flex justify-center" />
    </>
  );
}
