export type Area = "manager" | "shelf" | "findings";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: Record<Area, NavGroup[]> = {
  manager: [
    {
      label: "Overview",
      items: [
        { href: "/manager", label: "Command center", icon: "dashboard" },
        { href: "/manager/fei", label: "Equity index (FEI)", icon: "index" },
        { href: "/present", label: "Presentation", icon: "present" },
      ],
    },
    {
      label: "Analyze & plan",
      items: [
        { href: "/manager/map", label: "Map explorer", icon: "map" },
        { href: "/manager/scenarios", label: "Site planner", icon: "target" },
        { href: "/manager/allocation", label: "Supply allocation", icon: "truck" },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: "/manager/shelves", label: "Shelves & priorities", icon: "store" },
        { href: "/manager/alerts", label: "Alerts", icon: "bell" },
        { href: "/manager/requests", label: "Requests", icon: "inbox" },
      ],
    },
    {
      label: "Intelligence",
      items: [{ href: "/manager/briefing", label: "AI briefing", icon: "spark" }],
    },
  ],
  shelf: [
    {
      label: "My shelf",
      items: [
        { href: "/shelf", label: "Overview", icon: "home" },
        { href: "/shelf/report", label: "Monthly report", icon: "form" },
        { href: "/shelf/history", label: "History", icon: "history" },
      ],
    },
    {
      label: "Support",
      items: [
        { href: "/shelf/requests", label: "Requests", icon: "inbox" },
        { href: "/shelf/assistant", label: "Assistant", icon: "spark" },
        { href: "/shelf/settings", label: "Shelf profile", icon: "settings" },
      ],
    },
  ],
  findings: [
    {
      label: "Research",
      items: [
        { href: "/findings", label: "Story & findings", icon: "book" },
        { href: "/present", label: "Judging talk", icon: "present" },
        { href: "/findings/present", label: "Offline PDFs", icon: "list" },
        { href: "/findings/technical", label: "Technical details", icon: "settings" },
        { href: "/findings/sources", label: "Sources & data", icon: "list" },
      ],
    },
  ],
};

export const AREAS: { id: Area; label: string; href: string; icon: string }[] = [
  { id: "manager", label: "Manager", href: "/manager", icon: "dashboard" },
  { id: "shelf", label: "Food shelf", href: "/shelf", icon: "store" },
  { id: "findings", label: "Findings", href: "/findings", icon: "book" },
];

export const NAV_ITEMS: (NavItem & { area: Area; areaLabel: string; group: string })[] = (Object.keys(NAV) as Area[]).flatMap(
  (area) =>
    NAV[area].flatMap((g) =>
      g.items.map((i) => ({ ...i, area, group: g.label, areaLabel: AREAS.find((a) => a.id === area)!.label })),
    ),
);

/** Pages that fill the window (map workspaces) rather than a centered column. */
export const FULL_BLEED = ["/manager/map", "/manager/scenarios"];
