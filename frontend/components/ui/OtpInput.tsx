"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Segmented 6-digit code entry. Handles the things a plain text input
 * doesn't: auto-advance, backspace-to-previous, arrow navigation, and
 * pasting a whole code into any box.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  autoFocus = true,
  onComplete,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  onComplete?: (code: string) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setAt = (index: number, digit: string) => {
    const next = value.padEnd(length, " ").split("");
    next[index] = digit || " ";
    const joined = next.join("").replace(/\s/g, "").slice(0, length);
    onChange(joined);
    return joined;
  };

  const handleChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;

    if (digits.length > 1) {
      // Pasted (or fast-typed) — fill forward from this box.
      const merged = (value.slice(0, index) + digits).slice(0, length);
      onChange(merged);
      const focusAt = Math.min(merged.length, length - 1);
      refs.current[focusAt]?.focus();
      if (merged.length === length) onComplete?.(merged);
      return;
    }

    const joined = setAt(index, digits);
    if (index < length - 1) refs.current[index + 1]?.focus();
    if (joined.length === length) onComplete?.(joined);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        // Empty box — step back and clear the previous one.
        onChange(value.slice(0, index - 1) + value.slice(index));
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-2" role="group" aria-label={`${length}-digit verification code`}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          // one-time-code lets iOS/Android offer the SMS/email autofill chip
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={length}
          disabled={disabled}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          aria-label={`Digit ${i + 1}`}
          className={cn(
            "size-12 rounded-xl border border-input bg-transparent text-center text-lg font-semibold tabular-nums transition-all",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            "disabled:opacity-50",
            value[i] && "border-primary/50 bg-primary/5"
          )}
        />
      ))}
    </div>
  );
}
