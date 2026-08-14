import { useState } from "react";
import {
  DownloadIcon,
  FolderIcon,
  PackageOpenIcon,
  StarIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import type {
  ModFile,
  RemoteModInfo,
  RemoteProgress,
  Section as ModSection,
} from "@shared/schemas";
import type { ModIndex } from "@shared/graph";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useSaveFolderState, useSetFavorite } from "@/hooks/useMods";
import {
  useInstallMods,
  useRemoteModInfo,
  useRemoteOverview,
  useRemoteProgress,
  useResolveMissing,
  useUpdateMods,
} from "@/hooks/useRemote";
import { ModIconGlyph, TagIconGlyph, tagsBeyondCategory } from "@/lib/modIcons";
import { cn, displayName, formatBytes } from "@/lib/utils";

// The panel sits over the graph (a canvas you pan anyway, and one the
// fit already keeps clear) but beside the grid and list, where covering
// the thing you are reading is exactly wrong.
export type PanelPlacement = "floating" | "docked";

function panelClass(placement: PanelPlacement): string {
  return cn(
    "flex flex-col overflow-hidden bg-popover text-popover-foreground",
    placement === "floating"
      ? "absolute inset-y-3 right-3 z-40 w-72 rounded-xl border border-border shadow-floating"
      : "h-full w-full border-l border-border",
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

export function DetailPanel({
  file,
  index,
  orphan,
  dependencySet,
  folder,
  placement,
  onSelect,
  onClose,
  onToggle,
}: {
  file: ModFile;
  index: ModIndex;
  orphan: boolean;
  dependencySet: Set<string>;
  folder: string;
  placement: PanelPlacement;
  onSelect: (fileName: string) => void;
  onClose: () => void;
  onToggle: (enable: boolean) => void;
}) {
  const setFavorite = useSetFavorite();
  const saveState = useSaveFolderState(folder);

  const overview = useRemoteOverview();
  const remoteStatus = overview.data?.byFile[file.fileName];
  const remoteInfo = useRemoteModInfo(
    remoteStatus?.name ?? file.entries[0]?.name,
  );
  const updateMod = useUpdateMods();
  const progress = useRemoteProgress();
  const updateProgress = remoteStatus
    ? progress.get(remoteStatus.name)
    : undefined;
  const updating =
    updateMod.isPending || updateProgress?.phase === "downloading";

  const hardDeps = [...(index.hardDeps.get(file.fileName) ?? [])].toSorted();
  const optionalDeps = [
    ...(index.optionalDeps.get(file.fileName) ?? []),
  ].toSorted();
  const dependents = [
    ...(index.dependents.get(file.fileName) ?? []),
  ].toSorted();
  const optionalDependents = [
    ...(index.optionalDependents.get(file.fileName) ?? []),
  ].toSorted();
  const missing = index.missing.get(file.fileName) ?? [];
  const version = file.entries[0]?.version;

  // Which side of the mods/dependencies split this lands on, in both
  // views: the default follows hard dependents; picking the other side
  // stores an override, picking the default clears it.
  const defaultSection: ModSection =
    dependents.length > 0 ? "dependency" : "mod";
  const effectiveSection: ModSection = dependencySet.has(file.fileName)
    ? "dependency"
    : "mod";
  const setSection = (section: ModSection) => {
    saveState.mutate((state) => {
      const overrides = { ...state.sectionOverrides };
      if (section === defaultSection) delete overrides[file.fileName];
      else overrides[file.fileName] = section;
      return { ...state, sectionOverrides: overrides };
    });
  };

  return (
    <div className={panelClass(placement)}>
      <div className="shrink-0 border-b border-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {displayName(file.fileName)}
            </div>
            <div className="tabular mt-0.5 truncate text-[10px] text-muted-foreground/70">
              {file.fileName}, {formatBytes(file.sizeBytes)}
              {version ? `, v${version}` : ""}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="close"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </div>
        <ModFacts
          file={file}
          category={remoteStatus?.category}
          orphan={orphan}
        />
        <div className="mt-2.5 flex items-center gap-1.5">
          <Button
            size="sm"
            variant={file.enabled ? "outline" : "default"}
            className="flex-1"
            onClick={() => onToggle(!file.enabled)}
          >
            {file.enabled ? "disable" : "enable"}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={file.favorite ? "unfavorite" : "favorite"}
            aria-pressed={file.favorite}
            onClick={() =>
              setFavorite.mutate({
                fileName: file.fileName,
                favorite: !file.favorite,
              })
            }
          >
            <StarIcon
              className={cn("size-3.5", file.favorite && "fill-current")}
            />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="reveal in file manager"
            title="reveal in file manager"
            onClick={() =>
              void window.api.shell.showItemInFolder(
                `${folder}/${file.fileName}`,
              )
            }
          >
            <FolderIcon className="size-3.5" />
          </Button>
        </div>
        {remoteStatus?.updateAvailable && (
          <div className="mt-1.5">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={updating}
              onClick={() => updateMod.mutate([file.fileName])}
            >
              <DownloadIcon className="size-3.5" />
              {updating
                ? "updating…"
                : `update to ${remoteStatus.latestVersion}`}
            </Button>
            {updateProgress?.phase === "downloading" && (
              <ProgressBar
                className="mt-1 w-full"
                receivedBytes={updateProgress.receivedBytes}
                totalBytes={updateProgress.totalBytes}
              />
            )}
            {(updateMod.isError || updateProgress?.phase === "error") && (
              <p className="mt-1 text-[10px] text-destructive">
                update failed:{" "}
                {updateProgress?.error ??
                  (updateMod.error instanceof Error
                    ? updateMod.error.message
                    : "unknown error")}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {remoteInfo.data && (
          <RemoteInfoSection
            info={remoteInfo.data}
            latestVersion={remoteStatus?.latestVersion}
          />
        )}
        {file.parseError && (
          <p className="mb-3 text-xs text-destructive">
            manifest problem: {file.parseError}
          </p>
        )}
        {missing.length > 0 && (
          <MissingSection missing={missing} progress={progress} />
        )}
        <Section
          label="needs"
          count={hardDeps.length}
          empty="needs nothing beyond Everest"
        >
          {hardDeps.map((dep) => (
            <DepRow
              key={dep}
              fileName={dep}
              index={index}
              onSelect={onSelect}
            />
          ))}
        </Section>
        {optionalDeps.length > 0 && (
          <Section label="optionally uses" count={optionalDeps.length}>
            {optionalDeps.map((dep) => (
              <DepRow
                key={dep}
                fileName={dep}
                index={index}
                onSelect={onSelect}
              />
            ))}
          </Section>
        )}
        <Section
          label="needed by"
          count={dependents.length}
          empty="nothing depends on this"
        >
          {dependents.map((dep) => (
            <DepRow
              key={dep}
              fileName={dep}
              index={index}
              onSelect={onSelect}
            />
          ))}
        </Section>
        {optionalDependents.length > 0 && (
          <Section
            label="optionally needed by"
            count={optionalDependents.length}
          >
            {optionalDependents.map((dep) => (
              <DepRow
                key={dep}
                fileName={dep}
                index={index}
                onSelect={onSelect}
              />
            ))}
          </Section>
        )}
        <div className="mb-3">
          <h3 className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            treated as
          </h3>
          <SegmentedControl<ModSection>
            options={[
              {
                value: "mod",
                label: "mod",
                selected: effectiveSection === "mod",
              },
              {
                value: "dependency",
                label: "dependency",
                selected: effectiveSection === "dependency",
              },
            ]}
            onSelect={setSection}
          />
          {effectiveSection !== defaultSection && (
            <p className="mt-1 text-[10px] leading-tight text-muted-foreground/60">
              overriding the default ({defaultSection})
            </p>
          )}
        </div>
        {file.entries.length > 1 && (
          <Section label={`declares ${file.entries.length} mods`}>
            {file.entries.map((entry) => (
              <li
                key={entry.name}
                className="flex items-baseline gap-1.5 px-1.5 py-1 text-xs"
              >
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                <span className="tabular shrink-0 text-[10px] text-muted-foreground/60">
                  {entry.version}
                </span>
              </li>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

// Panel for a selected ghost node: a dependency that installed mods
// need but which isn't in the Mods folder. Offers the install flow and
// lists who needs it.
export function GhostPanel({
  name,
  index,
  placement,
  onSelect,
  onClose,
}: {
  name: string;
  index: ModIndex;
  placement: PanelPlacement;
  onSelect: (fileName: string) => void;
  onClose: () => void;
}) {
  const progress = useRemoteProgress();
  const neededBy = index.files
    .filter((f) => (index.missing.get(f.fileName) ?? []).includes(name))
    .map((f) => f.fileName)
    .toSorted();
  return (
    <div className={panelClass(placement)}>
      <div className="shrink-0 border-b border-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="mt-0.5 text-[10px] text-destructive">
              not installed
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="close"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <MissingSection
          missing={[name]}
          progress={progress}
          // Once this ghost is installed it stops existing as a node;
          // close rather than leave a panel about nothing selected.
          onInstalled={(names) => {
            if (names.includes(name)) onClose();
          }}
        />
        <Section label="needed by" count={neededBy.length}>
          {neededBy.map((dep) => (
            <DepRow
              key={dep}
              fileName={dep}
              index={index}
              onSelect={onSelect}
            />
          ))}
        </Section>
      </div>
    </div>
  );
}

// The facts row under the title: what the mod is (its GameBanana
// category, icon-led), structural traits beyond that, and warnings.
// Enabled state is NOT restated here: the enable/disable button right
// below already says it.
function ModFacts({
  file,
  category,
  orphan,
}: {
  file: ModFile;
  category: string | undefined;
  orphan: boolean;
}) {
  const extraTags = tagsBeyondCategory(category, file.tags);
  if (category === undefined && extraTags.length === 0 && !orphan) {
    return null;
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
      {category !== undefined && (
        <span className="inline-flex items-center gap-1 text-foreground/80">
          <ModIconGlyph
            category={category}
            tags={file.tags}
            className="size-3"
          />
          {category}
        </span>
      )}
      {extraTags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 text-muted-foreground"
        >
          <TagIconGlyph tag={tag} className="size-3" />
          {tag}
        </span>
      ))}
      {orphan && (
        <span className="inline-flex items-center gap-1 text-warn">
          <TriangleAlertIcon aria-hidden className="size-3" />
          orphan
        </span>
      )}
    </div>
  );
}

function Section({
  label,
  count,
  empty,
  children,
}: {
  label: string;
  count?: number;
  empty?: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);
  return (
    <div className="mb-3">
      <h3 className="mb-1 flex items-baseline justify-between text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        <span>{label}</span>
        {count !== undefined && (
          <span className="tabular font-normal text-muted-foreground/60">
            {count}
          </span>
        )}
      </h3>
      {hasChildren ? (
        <ul className="-mx-1.5">{children}</ul>
      ) : (
        empty && <p className="text-xs text-muted-foreground/60">{empty}</p>
      )}
    </div>
  );
}

// Screenshot with a graceful ladder: the original full-resolution
// image first (the mirror only stores 220px thumbnails), the mirrored
// copy when GameBanana's CDN fails, hidden when both do.
function Screenshot({
  shot,
  title,
}: {
  shot: { mirror?: string; original: string };
  title: string;
}) {
  const [stage, setStage] = useState<"original" | "mirror" | "hidden">(
    "original",
  );
  if (stage === "hidden") return null;
  return (
    <img
      src={stage === "mirror" ? shot.mirror : shot.original}
      alt={`${title} screenshot`}
      loading="lazy"
      className="aspect-video w-full rounded-lg border border-border object-cover"
      onError={() =>
        setStage(
          stage === "original" && shot.mirror !== undefined
            ? "mirror"
            : "hidden",
        )
      }
    />
  );
}

function RemoteInfoSection({
  info,
  latestVersion,
}: {
  info: RemoteModInfo;
  latestVersion: string | undefined;
}) {
  const shot = info.screenshots[0];
  return (
    <div className="mb-3">
      {shot && <Screenshot shot={shot} title={info.title} />}
      {info.description && (
        <p className="mt-2 text-xs leading-snug text-muted-foreground">
          {info.description}
        </p>
      )}
      <div className="tabular mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground/70">
        {info.author && <span className="truncate">by {info.author}</span>}
        <span>{formatCount(info.downloads)} downloads</span>
        <span>{formatCount(info.likes)} likes</span>
        {latestVersion !== undefined && <span>latest v{latestVersion}</span>}
        <button
          type="button"
          onClick={() => void window.api.shell.openExternal(info.pageUrl)}
          className="cursor-pointer text-muted-foreground underline-offset-2 outline-none hover:underline focus-visible:underline"
        >
          GameBanana ↗
        </button>
      </div>
    </div>
  );
}

// Missing dependencies, enriched by the remote database: each name is
// resolved to a version/size (transitively: a missing dep's own
// missing deps join the plan) and installable in one click.
function MissingSection({
  missing,
  progress,
  onInstalled,
}: {
  missing: string[];
  progress: Map<string, RemoteProgress>;
  onInstalled?: (names: string[]) => void;
}) {
  const plan = useResolveMissing(missing);
  const install = useInstallMods();
  const steps = plan.data?.steps;
  const rows =
    steps ?? missing.map((name) => ({ name, installable: false }) as const);
  const installable = (steps ?? []).filter((s) => s.installable);
  const totalBytes = installable.reduce(
    (sum, s) => sum + ("sizeBytes" in s ? (s.sizeBytes ?? 0) : 0),
    0,
  );
  const failed = install.data?.failed ?? [];
  return (
    <div className="mb-3">
      <h3 className="mb-1 flex items-baseline justify-between text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        <span>missing dependencies</span>
        <span className="tabular font-normal text-muted-foreground/60">
          {rows.length}
        </span>
      </h3>
      <ul className="-mx-1.5">
        {rows.map((step) => {
          const p = progress.get(step.name);
          return (
            <li key={step.name} className="px-1.5 py-1 text-xs">
              <div className="flex items-baseline gap-1.5">
                <span className="min-w-0 flex-1 truncate text-destructive">
                  {step.name}
                </span>
                {"version" in step && step.version !== undefined && (
                  <span className="tabular shrink-0 text-[10px] text-muted-foreground/60">
                    v{step.version}
                  </span>
                )}
                {"sizeBytes" in step && step.sizeBytes !== undefined && (
                  <span className="tabular shrink-0 text-[10px] text-muted-foreground/60">
                    {formatBytes(step.sizeBytes)}
                  </span>
                )}
              </div>
              {steps && !step.installable && (
                <p className="text-[10px] text-muted-foreground/60">
                  not in the mod database, install manually
                </p>
              )}
              {p?.phase === "downloading" && (
                <ProgressBar
                  className="mt-1 w-full"
                  receivedBytes={p.receivedBytes}
                  totalBytes={p.totalBytes}
                />
              )}
              {p?.phase === "error" && (
                <p className="text-[10px] text-destructive">{p.error}</p>
              )}
            </li>
          );
        })}
      </ul>
      {installable.length > 0 && (
        <Button
          size="sm"
          variant="outline"
          className="mt-1.5 w-full"
          disabled={install.isPending}
          onClick={() =>
            install.mutate(
              installable.map((s) => s.name),
              {
                onSuccess: (result) => {
                  if (result.installed.length > 0) {
                    onInstalled?.(result.installed);
                  }
                },
              },
            )
          }
        >
          <DownloadIcon className="size-3.5" />
          {install.isPending
            ? "installing…"
            : `install ${installable.length === 1 ? "it" : `all ${installable.length}`}${totalBytes > 0 ? ` (${formatBytes(totalBytes)})` : ""}`}
        </Button>
      )}
      {failed.length > 0 && (
        <p className="mt-1 text-[10px] text-destructive">
          {failed.length === 1
            ? `${failed[0]!.name} failed: ${failed[0]!.error}`
            : `${failed.length} installs failed`}
        </p>
      )}
    </div>
  );
}

function DepRow({
  fileName,
  index,
  onSelect,
}: {
  fileName: string;
  index: ModIndex;
  onSelect: (fileName: string) => void;
}) {
  const file = index.byFileName.get(fileName);
  return (
    <li className="group relative flex h-7 items-center gap-1.5 rounded-md px-1.5 transition-colors hover:bg-muted">
      <button
        type="button"
        onClick={() => onSelect(fileName)}
        aria-label={`select ${displayName(fileName)}`}
        className="absolute inset-0 cursor-pointer rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          file?.enabled ? "bg-on" : "bg-muted-foreground/30",
        )}
      />
      <span className="min-w-0 flex-1 truncate text-xs">
        {displayName(fileName)}
      </span>
      <span className="tabular shrink-0 text-[10px] text-muted-foreground/60">
        {file?.entries[0]?.version ?? ""}
      </span>
    </li>
  );
}

// What the docked panel shows with nothing selected. It holds the column
// open so choosing a mod never reflows the grid behind it.
export function EmptyPanel() {
  return (
    <div
      className={cn(
        panelClass("docked"),
        "items-center justify-center gap-2 px-6 text-center",
      )}
    >
      <PackageOpenIcon
        aria-hidden
        className="size-5 text-muted-foreground/40"
      />
      <p className="text-xs text-muted-foreground/60">
        pick a mod to see what it is and what it needs
      </p>
    </div>
  );
}
