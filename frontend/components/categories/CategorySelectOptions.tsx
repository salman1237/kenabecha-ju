import { Fragment } from "react";

import type { Category } from "@/types/api";

/** Sentinel <select> value for "not in the list, let me type one". Never a
 *  real category id, so it can't collide with one. */
export const OTHER_CATEGORY_VALUE = "other";

/**
 * Flattened category <option>s: each top-level category is itself
 * selectable (not just a group label), with its children listed indented
 * underneath — so picking a category doesn't force picking a subcategory
 * too. An "Other" option is appended last for whatever isn't in the list.
 */
export function CategorySelectOptions({
  categories,
  otherLabel,
}: {
  categories: Category[];
  otherLabel: string;
}) {
  return (
    <>
      {categories.map((cat) => (
        <Fragment key={cat.id}>
          <option value={cat.id}>{`${cat.icon || ""} ${cat.name}`.trim()}</option>
          {cat.children.map((child) => (
            <option key={child.id} value={child.id}>
              {"  — "}
              {child.name}
            </option>
          ))}
        </Fragment>
      ))}
      <option value={OTHER_CATEGORY_VALUE}>{otherLabel}</option>
    </>
  );
}
