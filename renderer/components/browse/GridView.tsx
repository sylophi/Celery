import { useRef, useState } from "react";
import { StarIcon } from "lucide-react";
import type { ModFile, RemoteFileStatus } from "@shared/schemas";
import { useSetFavorite } from "@/hooks/useMods";
import { useOnScreen } from "@/hooks/useOnScreen";
import { useRemoteModInfo } from "@/hooks/useRemote";
import { ModIconGlyph } from "@/lib/modIcons";
import { IDLE_STYLE, type IdleKind } from "@/lib/idle";
import { cn, displayName } from "@/lib/utils";
import {
  BrowseFrame,
  useBrowseScroller,
  type BrowseProps,
} from "./BrowseFrame";

// The gallery: mods as their own artwork, which is how anyone actually
// recognises a map pack. The GameBanana screenshot carries the tile and
// the category glyph drops to a corner chip, where it also stands in as
// the whole tile for the many helpers that have no art to show.

export function GridView(props: BrowseProps) {
  const { idle, updates, index, remoteOf, selectedId, onSelect } = props;
  return (
    <BrowseFrame
      {...props}
      className="flex h-full flex-col"
      gapClassName="gap-7"
      listClassName="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2"
      renderItem={(file) => (
        <ModCard
          key={file.fileName}
          file={file}
          remote={remoteOf(file.fileName)}
          selected={file.fileName === selectedId}
          idle={idle.get(file.fileName)?.kind}
          updateAvailable={updates.has(file.fileName)}
          missing={index.missing.get(file.fileName)?.length ?? 0}
          onSelect={onSelect}
        />
      )}
    />
  );
}

function ModCard({
  file,
  remote,
  selected,
  idle,
  updateAvailable,
  missing,
  onSelect,
}: {
  file: ModFile;
  remote: RemoteFileStatus | undefined;
  selected: boolean;
  idle: IdleKind | undefined;
  updateAvailable: boolean;
  missing: number;
  onSelect: (fileName: string) => void;
}) {
  const setFavorite = useSetFavorite();
  const name = displayName(file.fileName);
  const card = useRef<HTMLLIElement>(null);
  const onScreen = useOnScreen(card, useBrowseScroller());
  const info = useRemoteModInfo(
    remote?.name ?? file.entries[0]?.name,
    onScreen,
  );
  const shot = info.data?.screenshots[0];
  const source = shot?.mirror ?? shot?.original;
  // A broken mirror or a mod that was never on GameBanana both land on
  // the glyph, so the grid never shows a torn-image placeholder.
  const [broken, setBroken] = useState(false);
  const art = source !== undefined && !broken ? source : null;

  // One badge, worst news first: a broken mod outranks a wasteful one,
  // which outranks a merely out of date one. An unused mod sits below
  // all of those — it is a note, and an update is the more useful thing
  // to know about a mod that is otherwise fine.
  const badge =
    missing > 0 || file.parseError !== undefined
      ? {
          className: "bg-destructive",
          title: file.parseError ?? `${missing} missing dependencies`,
        }
      : idle === "orphan"
        ? { className: IDLE_STYLE.orphan.dot, title: IDLE_STYLE.orphan.hint }
        : updateAvailable
          ? { className: "bg-ring", title: "update available" }
          : idle === "unused"
            ? {
                className: IDLE_STYLE.unused.dot,
                title: IDLE_STYLE.unused.hint,
              }
            : null;

  return (
    // The star is a sibling of the card button, since a button inside a
    // button is not valid.
    <li ref={card} className="group relative">
      <button
        type="button"
        onClick={() => onSelect(file.fileName)}
        aria-label={`select ${name}`}
        aria-pressed={selected}
        className={cn(
          "flex w-full cursor-pointer flex-col gap-1.5 rounded-xl p-1.5 transition-colors outline-none",
          "hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
          selected && "bg-accent",
        )}
      >
        <span
          className={cn(
            "relative block aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted/50 ring-1 transition-all",
            selected ? "ring-2 ring-ring" : "ring-border",
            // Disabled mods keep their art but stop competing for
            // attention with the ones actually being loaded.
            !file.enabled && "opacity-45 saturate-50",
          )}
        >
          {art ? (
            <img
              src={art}
              alt=""
              loading="lazy"
              draggable={false}
              onError={() => setBroken(true)}
              className="size-full object-cover"
            />
          ) : (
            <span className="grid size-full place-items-center">
              <ModIconGlyph
                category={remote?.category}
                tags={file.tags}
                className="size-6 text-muted-foreground/50"
              />
            </span>
          )}
          {art && (
            // Only worth a chip once there is art to label; without it
            // the glyph already fills the tile.
            <span
              className="absolute bottom-1 left-1 grid size-5 place-items-center rounded-md bg-background/75 backdrop-blur-sm"
              {...(remote?.category !== undefined
                ? { title: remote.category }
                : {})}
            >
              <ModIconGlyph
                category={remote?.category}
                tags={file.tags}
                className="size-3 text-foreground/80"
              />
            </span>
          )}
        </span>
        <span
          className={cn(
            "line-clamp-2 h-7 w-full px-0.5 text-left text-[11px] leading-tight wrap-anywhere",
            file.enabled ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {name}
        </span>
      </button>
      {badge && (
        <span
          aria-hidden
          title={badge.title}
          className={cn(
            "pointer-events-none absolute top-3 right-3 size-2 rounded-full ring-2 ring-background",
            badge.className,
          )}
        />
      )}
      <button
        type="button"
        aria-label={file.favorite ? `unfavorite ${name}` : `favorite ${name}`}
        aria-pressed={file.favorite}
        onClick={() =>
          setFavorite.mutate({
            fileName: file.fileName,
            favorite: !file.favorite,
          })
        }
        className={cn(
          "absolute top-2.5 left-2.5 cursor-pointer rounded bg-background/70 p-1 backdrop-blur-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          file.favorite
            ? "text-foreground"
            : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100",
        )}
      >
        <StarIcon className={cn("size-3", file.favorite && "fill-current")} />
      </button>
    </li>
  );
}
