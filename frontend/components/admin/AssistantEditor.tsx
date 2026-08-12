"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { getAssistantSettings, setAssistantSettings } from "@/lib/api/dashboard-admin";
import type { AssistantSettings } from "@/types/api";

export function AssistantEditor() {
  const [settings, setLocal] = useState<AssistantSettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAssistantSettings()
      .then((data) => {
        setLocal(data);
        setEnabled(data.enabled);
        setSystemPrompt(data.system_prompt);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await setAssistantSettings({ enabled, system_prompt: systemPrompt });
      setLocal(updated);
      toast.success(updated.enabled ? "Assistant is live" : "Saved — turned off");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the assistant settings");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return <div className="h-72 animate-pulse rounded-2xl bg-muted" />;
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-soft-xs)]">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-sm font-semibold">AI shopping assistant</h2>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        The floating chat widget visitors can ask for listing recommendations. Needs
        OPENAI_API_KEY set on the backend to actually work once enabled.
      </p>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="assistant-prompt">
          System prompt
        </label>
        <Textarea
          id="assistant-prompt"
          rows={8}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="size-4 accent-emerald-600"
          />
          Enable the assistant
        </label>
        <Button onClick={save} loading={saving} loadingText="Saving" size="sm">
          Save
        </Button>
      </div>
    </div>
  );
}
