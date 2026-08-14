import type { OrphanKind } from "@shared/graph";

// One vocabulary for the two kinds of orphan, so a tile in the grid, a
// row in the list, a node in the graph and the status bar all say the
// same word about the same mod.
//
// Only `unused` is amber: it is the one you can act on outright, and
// deleting it costs nothing. Dormant is a note rather than a warning —
// the mod is doing no harm and will be wanted again the moment its
// dependent comes back — so it stays monochrome.
export const ORPHAN_STYLE: Record<
  OrphanKind,
  { label: string; hint: string; text: string; dot: string }
> = {
  unused: {
    label: "unused",
    hint: "enabled, and nothing installed asks for it",
    text: "text-warn",
    dot: "bg-warn",
  },
  dormant: {
    label: "dormant",
    hint: "enabled, but only disabled mods ask for it",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
};
