import { FolderIcon, StarIcon, XIcon } from "lucide-react";
import type {
  FolderState,
  Group,
  ModFile,
  Section as ModSection,
} from "@shared/schemas";
import type { ModIndex } from "@shared/graph";
import { displayName } from "@/App";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useSaveFolderState, useSetFavorite } from "@/hooks/useMods";
import { cn, formatBytes } from "@/lib/utils";

export function DetailPanel({
  file,
  index,
  orphan,
  folderState,
  dependencySet,
  folder,
  onSelect,
  onClose,
  onToggle,
}: {
  file: ModFile;
  index: ModIndex;
  orphan: boolean;
  folderState: FolderState;
  dependencySet: Set<string>;
  folder: string;
  onSelect: (fileName: string) => void;
  onClose: () => void;
  onToggle: (enable: boolean) => void;
}) {
  const setFavorite = useSetFavorite();
  const saveState = useSaveFolderState(folder);
  const groups = folderState.groups;

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

  // List placement: the default follows hard dependents; picking the
  // other side stores an override, picking the default clears it.
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

  const toggleMembership = (group: Group) => {
    saveState.mutate((state) => ({
      ...state,
      groups: state.groups.map((g) =>
        g.id === group.id
          ? {
              ...g,
              members: g.members.includes(file.fileName)
                ? g.members.filter((m) => m !== file.fileName)
                : [...g.members, file.fileName],
            }
          : g,
      ),
    }));
  };

  return (
    <div className="absolute inset-y-3 right-3 z-40 flex w-72 flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-floating">
      <div className="shrink-0 border-b border-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {displayName(file.fileName)}
            </div>
            <div className="tabular mt-0.5 truncate text-[10px] text-muted-foreground/70">
              {file.fileName} · {formatBytes(file.sizeBytes)}
              {version ? ` · v${version}` : ""}
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
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] ring-1 ring-border ring-inset",
              file.enabled ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                file.enabled ? "bg-on" : "bg-muted-foreground/40",
              )}
            />
            {file.enabled ? "enabled" : "disabled"}
          </span>
          {file.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border ring-inset"
            >
              {tag}
            </span>
          ))}
          {orphan && (
            <span className="rounded-md px-1.5 py-0.5 text-[10px] text-warn ring-1 ring-warn/40 ring-inset">
              orphan
            </span>
          )}
        </div>
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {file.parseError && (
          <p className="mb-3 text-xs text-destructive">
            manifest problem: {file.parseError}
          </p>
        )}
        {missing.length > 0 && (
          <Section label="missing dependencies">
            {missing.map((name) => (
              <li key={name} className="px-1.5 py-1 text-xs text-destructive">
                {name}
              </li>
            ))}
          </Section>
        )}
        <Section
          label={`needs · ${hardDeps.length}`}
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
          <Section label={`optionally uses · ${optionalDeps.length}`}>
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
          label={`needed by · ${dependents.length}`}
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
            label={`optionally needed by · ${optionalDependents.length}`}
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
            list placement
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
        {groups.length > 0 && (
          <div className="mb-1">
            <h3 className="mb-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              groups
            </h3>
            <div className="flex flex-wrap gap-1">
              {groups.map((group) => {
                const member = group.members.includes(file.fileName);
                return (
                  <button
                    key={group.id}
                    type="button"
                    aria-pressed={member}
                    onClick={() => toggleMembership(group)}
                    className={cn(
                      "cursor-pointer rounded-md border border-border px-2 py-1 text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      member
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {group.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  label,
  empty,
  children,
}: {
  label: string;
  empty?: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);
  return (
    <div className="mb-3">
      <h3 className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </h3>
      {hasChildren ? (
        <ul className="-mx-1.5">{children}</ul>
      ) : (
        empty && <p className="text-xs text-muted-foreground/60">{empty}</p>
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
