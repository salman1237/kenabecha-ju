import type { ReactNode } from "react";

/** Shared shell for the legal pages so Terms and Privacy stay visually
 *  consistent and neither drifts from the other's typography. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
      <div
        className={[
          "mt-8 flex flex-col gap-6 text-sm leading-relaxed text-muted-foreground",
          "[&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground",
          "[&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5",
          "[&_a]:font-medium [&_a]:text-emerald-600 [&_a]:underline dark:[&_a]:text-emerald-400",
          "[&_strong]:font-semibold [&_strong]:text-foreground",
        ].join(" ")}
      >
        {children}
      </div>
    </article>
  );
}
