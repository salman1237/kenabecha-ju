"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  /** Rendered cell. Omit `sortValue` for columns that shouldn't sort. */
  cell: (row: T) => React.ReactNode;
  /** Primitive used for sorting and CSV export. */
  sortValue?: (row: T) => string | number;
  /** Hide on narrow screens — the card fallback still shows everything. */
  hideOnMobile?: boolean;
  className?: string;
}

function toCsv<T>(rows: T[], columns: Column<T>[]): string {
  const exportable = columns.filter((c) => c.sortValue);
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    // Quote anything containing a delimiter, quote, or newline; double
    // up embedded quotes per RFC 4180.
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = exportable.map((c) => esc(c.header)).join(",");
  const body = rows.map((r) => exportable.map((c) => esc(c.sortValue!(r))).join(",")).join("\n");
  return `${head}\n${body}`;
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  loading,
  searchPlaceholder = "Search…",
  searchValue,
  onSearchChange,
  /** Fields searched when the table filters locally. */
  searchKeys,
  exportName,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  actions,
  selection,
}: {
  rows: T[];
  columns: Column<T>[];
  loading?: boolean;
  searchPlaceholder?: string;
  /** Provide both to make search server-driven; omit for local filtering. */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchKeys?: (row: T) => string;
  exportName?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: (row: T) => React.ReactNode;
  /** Opt-in multi-select. Omitted, the table has no checkboxes at all — most
   *  tables have nothing worth doing in bulk. */
  selection?: {
    selected: Set<string>;
    onChange: (selected: Set<string>) => void;
    /** Rendered above the table while anything is selected. */
    bar: (selected: string[], clear: () => void) => React.ReactNode;
  };
}) {
  const [localQuery, setLocalQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const isServerSearch = onSearchChange !== undefined;
  const query = isServerSearch ? (searchValue ?? "") : localQuery;

  const visible = useMemo(() => {
    let out = rows;

    // Local filtering only — when search is server-driven the rows arriving
    // are already filtered and re-filtering here would double-apply it.
    if (!isServerSearch && localQuery && searchKeys) {
      const needle = localQuery.toLowerCase();
      out = out.filter((r) => searchKeys(r).toLowerCase().includes(needle));
    }

    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        out = [...out].sort((a, b) => {
          const av = col.sortValue!(a);
          const bv = col.sortValue!(b);
          const cmp =
            typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av).localeCompare(String(bv));
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, localQuery, isServerSearch, searchKeys, sort, columns]);

  const toggleSort = (key: string) =>
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );

  // Header checkbox acts on what is *visible*, not on every row loaded:
  // ticking it after a search should select the search results, which is
  // what someone filtering to "spam" then selecting all expects.
  const selectedHere = selection
    ? visible.filter((row) => selection.selected.has(row.id)).length
    : 0;
  const allHereSelected = selection !== undefined && visible.length > 0 && selectedHere === visible.length;

  const toggleAll = () => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (allHereSelected) visible.forEach((row) => next.delete(row.id));
    else visible.forEach((row) => next.add(row.id));
    selection.onChange(next);
  };

  const toggleOne = (id: string) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onChange(next);
  };

  const onExport = () => {
    const csv = toCsv(visible, columns);
    // BOM so Excel opens UTF-8 (Bangla shop names) without mojibake.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName ?? "export"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) =>
              isServerSearch ? onSearchChange!(e.target.value) : setLocalQuery(e.target.value)
            }
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-9 rounded-xl pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">{visible.length} rows</span>
        {exportName && (
          <Button variant="outline" size="sm" onClick={onExport} disabled={visible.length === 0}>
            <Download /> Export CSV
          </Button>
        )}
      </div>

      {selection && selection.selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5">
          <span className="text-sm font-medium tabular-nums">
            {selection.selected.size} selected
          </span>
          {selection.bar([...selection.selected], () => selection.onChange(new Set()))}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          {/* Desktop table — scrolls horizontally rather than squashing */}
          <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  {selection && (
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={allHereSelected}
                        onChange={toggleAll}
                        aria-label="Select all rows"
                        className="size-4 accent-emerald-600"
                      />
                    </TableHead>
                  )}
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn(col.hideOnMobile && "hidden lg:table-cell", col.className)}
                    >
                      {col.sortValue ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          className="flex items-center gap-1 transition-colors hover:text-foreground"
                          aria-label={`Sort by ${col.header}`}
                        >
                          {col.header}
                          {sort?.key === col.key ? (
                            sort.dir === "asc" ? (
                              <ArrowUp className="size-3" />
                            ) : (
                              <ArrowDown className="size-3" />
                            )
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        col.header
                      )}
                    </TableHead>
                  ))}
                  {actions && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={selection?.selected.has(row.id) ? "selected" : undefined}
                  >
                    {selection && (
                      <TableCell className="w-10">
                        <input
                          type="checkbox"
                          checked={selection.selected.has(row.id)}
                          onChange={() => toggleOne(row.id)}
                          aria-label="Select row"
                          className="size-4 accent-emerald-600"
                        />
                      </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(col.hideOnMobile && "hidden lg:table-cell", col.className)}
                      >
                        {col.cell(row)}
                      </TableCell>
                    ))}
                    {actions && <TableCell className="text-right">{actions(row)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: cards instead of a table nobody can read on a phone */}
          <div className="flex flex-col gap-3 md:hidden">
            {visible.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-4"
              >
                {selection && (
                  <label className="flex items-center gap-2 border-b border-border pb-2 text-xs font-medium">
                    <input
                      type="checkbox"
                      checked={selection.selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      className="size-4 accent-emerald-600"
                    />
                    Select
                  </label>
                )}
                {columns.map((col) => (
                  <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                    <span className="shrink-0 text-xs text-muted-foreground">{col.header}</span>
                    <span className="min-w-0 text-right">{col.cell(row)}</span>
                  </div>
                ))}
                {actions && (
                  <div className="flex justify-end gap-2 border-t border-border pt-2">
                    {actions(row)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
