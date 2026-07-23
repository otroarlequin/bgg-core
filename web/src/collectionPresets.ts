import type { CollectionQueryParams } from "./api/types";

export type CollectionPreset = "all" | "owned" | "wishlist" | "preordered";

export function collectionFiltersFromPreset(
  preset: CollectionPreset,
): CollectionQueryParams {
  const base: CollectionQueryParams = {
    includeExpansions: true,
    sortBy: "name",
  };
  switch (preset) {
    case "all":
      return base;
    case "owned":
      return { ...base, own: true };
    case "wishlist":
      return { ...base, wishlist: true };
    case "preordered":
      return { ...base, preordered: true };
  }
}
