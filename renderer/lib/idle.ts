// The views draw one badge slot per mod, and a mod can be at most one
// of the two things that leave it enabled for nothing. "Idle" is the
// slot, not a third concept — it is never shown to anyone. What gets
// shown is one of these two words, and they never share a screen.
//
// Each carries the hue its token defines, so the same finding is the
// same color in a tile dot, a list label, a graph node and the status
// bar chip that opens its review.
export type IdleState =
  | { kind: "orphan" }
  | { kind: "unused"; wantedBy: string[] };
export type IdleKind = IdleState["kind"];

export const IDLE_STYLE: Record<
  IdleKind,
  { label: string; hint: string; text: string; dot: string }
> = {
  orphan: {
    label: "orphan",
    hint: "enabled, and nothing installed asks for it",
    text: "text-orphan",
    dot: "bg-orphan",
  },
  unused: {
    label: "unused",
    hint: "enabled, but the only mods asking for it are disabled",
    text: "text-unused",
    dot: "bg-unused",
  },
};
