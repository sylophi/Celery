import { StarIcon } from "lucide-react";
import type { ModFile, RemoteFileStatus } from "@shared/schemas";
import { useSetFavorite } from "@/hooks/useMods";
import { ModIconGlyph } from "@/lib/modIcons";
import { FINDING, type IdleKind } from "@/lib/findings";
import { cn, displayName, formatBytes } from "@/lib/utils";
import { BrowseFrame, type BrowseProps } from "./BrowseFrame";

// The dense one. Where the grid trades detail for recognisability, the
// list spends the same room on the columns you would otherwise have to
// open each mod to compare: version, category, size, what needs it.

export function ListView(props: BrowseProps) {
  const { idle, updates, index, remoteOf, selectedId, onSelect } = props;
  return (
    <BrowseFrame
      {...props}
      className="@container flex h-full flex-col"
      gapClassName="gap-6"
      listClassName=""
      renderItem={(file) => (
        <ModRow
          key={file.fileName}
          file={file}
          remote={remoteOf(file.fileName)}
          selected={file.fileName === selectedId}
          idle={idle.get(file.fileName)?.kind}
          updateAvailable={updates.has(file.fileName)}
          missing={index.missing.get(file.fileName)?.length ?? 0}
          neededBy={index.dependents.get(file.fileName)?.size ?? 0}
          onSelect={onSelect}
        />
      )}
    />
  );
}

function ModRow({
  file,
  remote,
  selected,
  idle,
  updateAvailable,
  missing,
  neededBy,
  onSelect,
}: {
  file: ModFile;
  remote: RemoteFileStatus | undefined;
  selected: boolean;
  idle: IdleKind | undefined;
  updateAvailable: boolean;
  missing: number;
  neededBy: number;
  onSelect: (fileName: string) => void;
}) {
  const setFavorite = useSetFavorite();
  const name = displayName(file.fileName);
  const version = file.entries[0]?.version ?? "";

  return (
    <li
      className={cn(
        "group relative flex h-8 items-center gap-2.5 rounded-md px-2 transition-colors",
        // A rail rather than a glow: at 32px a row, a hundred of them
        // stacked, anything that spills past its own edge turns the
        // list into a smear.
        selected
          ? "bg-accent before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:content-[''] before:gradient-accent"
          : "hover:bg-accent/70",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(file.fileName)}
        aria-label={`select ${name}`}
        aria-pressed={selected}
        className="absolute inset-0 cursor-pointer rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <span
        aria-hidden
        title={file.enabled ? "enabled" : "disabled"}
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          file.enabled ? "bg-on" : "bg-muted-foreground/30",
        )}
      />
      <ModIconGlyph
        category={remote?.category}
        tags={file.tags}
        className="size-3.5 shrink-0 text-muted-foreground/70"
        {...(remote?.category !== undefined ? { title: remote.category } : {})}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px]",
          file.enabled ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {name}
      </span>

      {missing > 0 && (
        <span
          className="shrink-0 text-[10px] text-destructive"
          title={`${missing} dependencies are not installed`}
        >
          {missing} missing
        </span>
      )}
      {file.parseError !== undefined && (
        <span
          className="shrink-0 text-[10px] text-destructive"
          title={file.parseError}
        >
          no manifest
        </span>
      )}
      {idle !== undefined && (
        <span
          className={cn("shrink-0 text-[10px]", FINDING[idle].text)}
          title={FINDING[idle].hint}
        >
          {FINDING[idle].label}
        </span>
      )}
      {updateAvailable && (
        <span
          className={cn("shrink-0 text-[10px]", FINDING.update.text)}
          title={`GameBanana has ${remote?.latestVersion ?? "a newer build"}`}
        >
          {FINDING.update.label}
        </span>
      )}

      {/* Columns hold their width so the eye can run down them, and drop
          out entirely before the name starts truncating. */}
      <span className="hidden w-28 shrink-0 truncate text-right text-[11px] text-muted-foreground/70 @3xl:block">
        {remote?.category ?? ""}
      </span>
      {/* Hard dependents only, enabled or not. An orphan therefore
          never shows one and an unused mod usually does. Only usually,
          because a mod wanted only as an OPTIONAL dependency still
          counts as unused while leaving this column blank. */}
      <span
        className="tabular hidden w-24 shrink-0 truncate text-right text-[11px] text-muted-foreground/70 @2xl:block"
        {...(neededBy > 0
          ? {
              title: `${neededBy} installed mods depend on this, enabled or not`,
            }
          : {})}
      >
        {neededBy > 0 ? `${neededBy} need it` : ""}
      </span>
      <span className="tabular hidden w-14 shrink-0 truncate text-right text-[11px] text-muted-foreground/60 @xl:block">
        {version}
      </span>
      <span className="tabular w-16 shrink-0 text-right text-[11px] text-muted-foreground/60">
        {formatBytes(file.sizeBytes)}
      </span>

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
          "relative shrink-0 cursor-pointer rounded p-0.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          file.favorite
            ? "text-foreground"
            : "text-muted-foreground/60 opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100",
        )}
      >
        <StarIcon className={cn("size-3", file.favorite && "fill-current")} />
      </button>
    </li>
  );
}
