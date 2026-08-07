import { createElement } from "react";
import {
  CogIcon,
  ConstructionIcon,
  HammerIcon,
  ImageIcon,
  MapIcon,
  MessageSquareTextIcon,
  MusicIcon,
  PackageIcon,
  PanelsTopLeftIcon,
  ShirtIcon,
  SparklesIcon,
  UsersIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import type { StructuralTag } from "@shared/schemas";

// Icons for what a mod IS. The GameBanana category (remote, curated) is
// the primary source; the structural tags derived from zip contents
// stand in when the mod is unmapped or the app is offline.

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Maps: MapIcon,
  Skins: ShirtIcon,
  Helpers: WrenchIcon,
  "Other/Misc": PackageIcon,
  Assets: ImageIcon,
  Tools: HammerIcon,
  UI: PanelsTopLeftIcon,
  WiPs: ConstructionIcon,
  Mechanics: CogIcon,
  Dialog: MessageSquareTextIcon,
  Effects: SparklesIcon,
};

export const TAG_ICONS: Record<StructuralTag, LucideIcon> = {
  collab: UsersIcon,
  "map-pack": MapIcon,
  helper: WrenchIcon,
  skin: ShirtIcon,
  audio: MusicIcon,
  "asset-pack": ImageIcon,
};

// Priority when only structural tags are available: the most specific
// signal wins (a collab is more telling than "has maps").
const TAG_PRIORITY: StructuralTag[] = [
  "collab",
  "map-pack",
  "helper",
  "skin",
  "audio",
  "asset-pack",
];

export function modIcon(
  category: string | undefined,
  tags: StructuralTag[],
): LucideIcon {
  if (category !== undefined) {
    return CATEGORY_ICONS[category] ?? PackageIcon;
  }
  for (const tag of TAG_PRIORITY) {
    if (tags.includes(tag)) return TAG_ICONS[tag];
  }
  return PackageIcon;
}

// A structural tag that restates the category adds no information in
// the detail panel; only tags outside this mapping are worth showing
// next to it.
const CATEGORY_COVERS: Record<string, StructuralTag> = {
  Maps: "map-pack",
  Helpers: "helper",
  Skins: "skin",
  Assets: "asset-pack",
};

export function tagsBeyondCategory(
  category: string | undefined,
  tags: StructuralTag[],
): StructuralTag[] {
  if (category === undefined) return tags;
  return tags.filter((tag) => CATEGORY_COVERS[category] !== tag);
}

// Render helpers: the icon component is selected from static records,
// so the reference is stable across renders. createElement keeps that
// selection out of JSX, where the compiler lint would (reasonably)
// suspect a component created during render.
export function ModIconGlyph({
  category,
  tags,
  className,
  title,
}: {
  category: string | undefined;
  tags: StructuralTag[];
  className?: string;
  title?: string;
}) {
  return createElement(modIcon(category, tags), {
    "aria-hidden": true,
    ...(className !== undefined ? { className } : {}),
    ...(title !== undefined ? { title } : {}),
  });
}

export function TagIconGlyph({
  tag,
  className,
}: {
  tag: StructuralTag;
  className?: string;
}) {
  return createElement(TAG_ICONS[tag], {
    "aria-hidden": true,
    ...(className !== undefined ? { className } : {}),
  });
}
