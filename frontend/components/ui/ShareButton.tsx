"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Uses the native share sheet where available (mobile, Safari), falling
 * back to copying the URL. Cancelling the native sheet throws AbortError,
 * which is a user action, not a failure — so it's swallowed silently
 * rather than surfaced as an error toast.
 */
export function ShareButton({ title, text }: { title: string; text?: string }) {
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        // Anything else (e.g. share unsupported for this payload) falls
        // through to the clipboard path below.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link — you can copy it from the address bar.");
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={onShare}>
      {copied ? <Check /> : <Share2 />}
      {copied ? "Copied" : "Share"}
    </Button>
  );
}
