"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import type { BulkResult } from "@/types/api";

export interface BulkAction {
  label: string;
  run: (ids: string[]) => Promise<BulkResult>;
  destructive?: boolean;
  /** Shown in a confirmation dialog before anything happens. */
  confirm?: string;
}

/**
 * The action bar shown above a table while rows are selected.
 *
 * Reports the API's per-item result rather than a flat "done": items are
 * independent, so a run where three of twenty failed has to say so — a
 * moderator who is told "success" and later finds three listings still up
 * has been misled by their own tool.
 */
export function BulkBar({
  ids,
  clear,
  onDone,
  actions,
}: {
  ids: string[];
  clear: () => void;
  onDone: () => void;
  actions: BulkAction[];
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<BulkAction | null>(null);

  const perform = async (action: BulkAction) => {
    setBusy(true);
    try {
      const result = await action.run(ids);
      if (result.failed.length === 0) {
        toast.success(`${result.succeeded.length} updated`);
      } else {
        toast.warning(
          `${result.succeeded.length} updated, ${result.failed.length} failed`,
          { description: result.failed[0]?.reason }
        );
      }
      clear();
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That did not work");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            size="sm"
            variant={action.destructive ? "destructive" : "outline"}
            disabled={busy}
            onClick={() => (action.confirm ? setConfirming(action) : perform(action))}
          >
            {action.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" disabled={busy} onClick={clear}>
          Clear
        </Button>
      </div>

      <AlertDialog open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming?.label} {ids.length} item{ids.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>{confirming?.confirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => confirming && perform(confirming)}
            >
              {confirming?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
