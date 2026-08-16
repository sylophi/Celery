import {
  DownloadIcon,
  MoonIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";

// One table for the three things the app finds and expects you to deal
// with. Every surface that draws one reads it here, so a finding is the
// same word and the same hue in a tile dot, a list label, a graph node,
// a detail panel and the status bar chip that opens its review.
//
// Tailwind class names are written out rather than interpolated: its
// scanner only sees the ones it can read literally.
//
// Chips carry a wash of their own hue and give off a little of it. That
// is the app's house effect, and a finding is exactly the kind of thing
// it is for: the chip is a live control, and the glow is what separates
// it from the dead text sitting beside it in the status bar. The glow
// itself (shadow-glow-finding, a currentColor geometry) lives on the
// CountChip in Toolbar.tsx, since it is the same for every hue.
export type Finding = "orphan" | "unused" | "update";

export const FINDING: Record<
  Finding,
  {
    label: string;
    hint: string;
    // A list label, a tile dot, a status bar chip.
    text: string;
    dot: string;
    chip: string;
    icon: LucideIcon;
  }
> = {
  orphan: {
    label: "orphan",
    hint: "enabled, and nothing installed asks for it",
    text: "text-orphan",
    dot: "bg-orphan",
    chip: "border-orphan/40 bg-orphan/10 text-orphan hover:bg-orphan/20",
    icon: TriangleAlertIcon,
  },
  update: {
    label: "update",
    hint: "GameBanana has a newer build",
    text: "text-update",
    dot: "bg-update",
    chip: "border-update/40 bg-update/10 text-update hover:bg-update/20",
    icon: DownloadIcon,
  },
  unused: {
    label: "unused",
    hint: "enabled, but the only mods asking for it are disabled",
    text: "text-unused",
    dot: "bg-unused",
    chip: "border-unused/40 bg-unused/10 text-unused hover:bg-unused/20",
    // A triangle would overstate it: that mod is doing nothing wrong,
    // it is only asleep.
    icon: MoonIcon,
  },
};

// The two findings a mod can carry in its one badge slot. They are
// mutually exclusive, since an orphan is precisely one nothing wants,
// so a mod has at most one. An update sits alongside either.
export type IdleState =
  | { kind: "orphan" }
  | { kind: "unused"; wantedBy: string[] };
export type IdleKind = IdleState["kind"];
