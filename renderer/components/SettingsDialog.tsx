import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Theme, UpdaterState } from "@shared/schemas";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useConfig } from "@/hooks/useMods";
import { useTheme } from "@/hooks/useTheme";
import { queryKeys } from "@/lib/queryKeys";

export function SettingsDialog({
  open,
  onClose,
  folder,
}: {
  open: boolean;
  onClose: () => void;
  folder: string | undefined;
}) {
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const configQuery = useConfig();

  const setConfirmCascades = async (next: boolean) => {
    const config = await window.api.config.read();
    await window.api.config.write({ ...config, confirmCascades: next });
    await queryClient.invalidateQueries({ queryKey: queryKeys.config });
  };

  const changeFolder = async () => {
    const picked = await window.api.dialog.pickFolder();
    if (!picked) return;
    const config = await window.api.config.read();
    await window.api.config.write({ ...config, modsFolder: picked });
    await queryClient.invalidateQueries();
  };

  return (
    <Dialog open={open} onClose={onClose} title="settings">
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex min-h-7 items-center justify-between gap-3">
            <span className="shrink-0 text-xs text-muted-foreground">mods folder</span>
            <Button variant="outline" size="xs" onClick={() => void changeFolder()}>
              change
            </Button>
          </div>
          <p className="truncate text-[11px] text-muted-foreground/70" title={folder}>
            {folder ?? "not set"}
          </p>
        </div>
        <div className="flex min-h-7 items-center justify-between gap-3">
          <div>
            <span className="text-xs text-muted-foreground">confirm dependency cascades</span>
            <p className="text-[10px] leading-tight text-muted-foreground/60">
              preview which mods a toggle drags along before writing
            </p>
          </div>
          <Switch
            checked={configQuery.data?.confirmCascades ?? false}
            label="confirm dependency cascades"
            onChange={(next) => void setConfirmCascades(next)}
          />
        </div>
        <div className="flex min-h-7 items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">theme</span>
          <SegmentedControl<Theme>
            options={(["light", "system", "dark"] as const).map((value) => ({
              value,
              label: value,
              selected: theme === value,
            }))}
            onSelect={setTheme}
          />
        </div>
        <UpdatesRow />
        <p className="text-[10px] leading-tight text-muted-foreground/70">
          Celery reads and writes Everest's own files (blacklist.txt, favorites.txt), so the in-game
          menu and Olympus stay in sync
        </p>
      </div>
    </Dialog>
  );
}

function UpdatesRow() {
  const [state, setState] = useState<UpdaterState | null>(null);
  useEffect(() => {
    let mounted = true;
    void window.api.updater.get().then((s) => {
      if (mounted) setState(s);
    });
    const off = window.api.updater.onState(setState);
    return () => {
      mounted = false;
      off();
    };
  }, []);

  const label = (() => {
    switch (state?.kind) {
      case "checking":
        return "checking…";
      case "downloading":
        return "downloading…";
      case "error":
        return "check failed";
      default:
        return null;
    }
  })();

  return (
    <div className="flex min-h-7 items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground">updates</span>
        {state?.kind === "unsupported" && (
          <p className="text-[10px] leading-tight text-muted-foreground/60">
            auto-update needs the installed macOS build — portable and dev builds update by
            downloading a new release
          </p>
        )}
        {state?.kind === "error" && (
          <p className="truncate text-[10px] leading-tight text-destructive" title={state.message}>
            {state.message}
          </p>
        )}
      </div>
      {state?.kind === "ready" ? (
        <Button size="xs" onClick={() => void window.api.updater.install()}>
          restart to update to v{state.version}
        </Button>
      ) : state?.kind === "unsupported" ? null : (
        <Button
          variant="outline"
          size="xs"
          disabled={state?.kind === "checking" || state?.kind === "downloading"}
          onClick={() => void window.api.updater.check()}
        >
          {label ?? "check for updates"}
        </Button>
      )}
    </div>
  );
}
