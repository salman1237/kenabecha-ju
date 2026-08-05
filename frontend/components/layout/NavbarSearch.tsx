"use client";

import { Search, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import { getSearchSuggestions } from "@/lib/api/listings";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

export function NavbarSearch() {
  const router = useRouter();
  const { t } = useLanguage();
  
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const containerRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    getSearchSuggestions(debouncedQuery)
      .then((results) => {
        setSuggestions(results);
        setIsOpen(true);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setIsOpen(false);
    router.push(`/listings?q=${encodeURIComponent(query)}`);
  };

  const onSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setIsOpen(false);
    router.push(`/listings?q=${encodeURIComponent(suggestion)}`);
  };

  return (
    <form ref={containerRef} onSubmit={onSubmit} className="relative hidden w-full max-w-sm lg:block lg:max-w-md">
      <div className="relative flex items-center">
        <Search className="absolute left-3 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length < 2) setIsOpen(false);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder="Search items..."
          className="h-9 w-full rounded-full border-emerald-500/20 bg-emerald-500/5 pl-9 pr-8 text-sm focus-visible:ring-emerald-500/20"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute inset-x-0 top-full mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-xl shadow-emerald-500/10 z-50">
          <ul className="py-1">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onClick={() => onSuggestionClick(suggestion)}
                  className="flex w-full items-center px-4 py-2 text-sm text-left hover:bg-muted focus:bg-muted focus:outline-none transition-colors"
                >
                  <Search className="mr-2 size-3.5 text-muted-foreground" />
                  <span className="truncate">{suggestion}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
