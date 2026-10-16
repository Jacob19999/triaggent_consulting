import { PATHS } from "@/components/ui";
import type { SiteType } from "@/lib/networks";

/** One colour per Organization.AgencyType, shared by the map donuts, filters and tables. */
export const TYPE_COLOR: Record<SiteType, string> = {
  "Brick and Mortar Site": "var(--type-brick)",
  "Outreach Program": "var(--type-outreach)",
  "Tribal Program": "var(--type-tribal)",
  "College Campus Program": "var(--type-campus)",
};

export const TYPE_SHORT: Record<SiteType, string> = {
  "Brick and Mortar Site": "Brick & mortar",
  "Outreach Program": "Outreach / mobile",
  "Tribal Program": "Tribal",
  "College Campus Program": "Campus",
};

/** Map icon per type (24x24 stroke paths from the app's icon set). */
export const TYPE_GLYPH: Record<SiteType, string> = {
  "Brick and Mortar Site": PATHS.store,
  "Outreach Program": PATHS.truck,
  "Tribal Program": PATHS.users,
  "College Campus Program": PATHS.book,
};
