"use client";

import { AlertTriangle, Home, RotateCw } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

/** Shared body for error.tsx and not-found.tsx so both read the same and
 *  neither drifts. Kept separate from the ErrorState used for failed data
 *  fetches inside a page, which is inline rather than full-page. */
export function FullPageError({
  title,
  description,
  digest,
  onRetry,
}: {
  title: string;
  description: string;
  /** Present only on thrown errors — matches the entry in server logs. */
  digest?: string;
  onRetry?: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-7" />
      </span>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>

      {digest && (
        // Surfaced so a user can quote it in a bug report; it's the only
        // handle that ties their crash to a specific server log line.
        <code className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
          {digest}
        </code>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button onClick={onRetry}>
            <RotateCw /> {t.common.tryAgain}
          </Button>
        )}
        <Link href="/" className={cn(buttonVariants({ variant: onRetry ? "outline" : "default" }))}>
          <Home /> {t.nav.home}
        </Link>
        <Link href="/listings" className={cn(buttonVariants({ variant: "ghost" }))}>
          {t.nav.browse}
        </Link>
      </div>
    </div>
  );
}
