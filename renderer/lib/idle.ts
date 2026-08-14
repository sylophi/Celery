// The views draw one badge slot per mod, and a mod can be at most one
// of the two things that leave it enabled for nothing. "Idle" is the
// slot, not a third concept — it is never shown to anyone. What gets
// shown is one of these two words, and they never share a screen.
//
// Only an orphan is amber: it is the one with a standing action behind
// it, and deleting it costs nothing. Unused is a note — that mod is
// wanted, just not right now — so it stays monochrome.
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
    text: "text-warn",
    dot: "bg-warn",
  },
  unused: {
    label: "unused",
    hint: "enabled, but the only mods asking for it are disabled",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
};
