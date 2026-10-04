"use client";

import { usePathname, useSearchParams } from "next/navigation";
import WorkoutCatalog from "./WorkoutCatalog";
import {
  CATEGORY_PARAM,
  EQUIPMENT_PARAM,
  catalogQuery,
  parseCategory,
  parseNoEquipment,
  type CatalogFilter,
} from "./catalog";

/**
 * WorkoutCatalog bound to the URL (?c=legs&eq=none). Uses useSearchParams, so the page must
 * wrap it in <Suspense> (Next 16 prerendering). Filter changes use history.replaceState, which
 * Next syncs into useSearchParams without a server round trip or a new history entry.
 */
export default function WorkoutCatalogRoute() {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "/workouts";
  const filter: CatalogFilter = {
    category: parseCategory(searchParams.get(CATEGORY_PARAM)),
    noEquipment: parseNoEquipment(searchParams.get(EQUIPMENT_PARAM)),
  };

  function onChange(next: CatalogFilter) {
    window.history.replaceState(null, "", `${pathname}${catalogQuery(next)}`);
  }

  return <WorkoutCatalog filter={filter} onChange={onChange} />;
}
