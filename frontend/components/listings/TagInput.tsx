"use client";

import { useEffect, useRef, useState } from "react";

import { inputClass } from "@/components/ui/FormField";
import { autocompleteTags } from "@/lib/api/tags";

export function TagInput({
  value,
  onChange,
  max = 10,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number;
}) {
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      autocompleteTags(text.trim())
        .then((tags) => setSuggestions(tags.map((t) => t.name).filter((n) => !value.includes(n))))
        .catch(() => setSuggestions([]));
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, value]);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || value.includes(trimmed) || value.length >= max) return;
    onChange([...value, trimmed]);
    setText("");
    setSuggestions([]);
  };

  const removeTag = (tag: string) => onChange(value.filter((t) => t !== tag));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className={inputClass}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(text);
          }
        }}
        placeholder={value.length >= max ? `Max ${max} tags` : "Type a tag and press Enter"}
        disabled={value.length >= max}
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.slice(0, 6).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => addTag(s)}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
