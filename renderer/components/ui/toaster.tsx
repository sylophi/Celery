import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/hooks/useTheme";

// Transient feedback lives here rather than in the layout: an action's
// outcome ("enabled X + 3 dependencies", "couldn't write blacklist")
// has nothing to do with where you triggered it from. Bottom-right,
// clear of the status bar, which is the readout that does not go away.
//
// Everything is repainted in the app's own tokens. Sonner's defaults
// bring their own palette, and `!` outranks its inline utilities.
export function Toaster() {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      offset={{ bottom: 38, right: 12 }}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "glass! !text-popover-foreground !border !border-border !shadow-floating",
          // The app disables text selection globally. A message you may
          // need to copy (a filesystem error) is the exception.
          title: "!text-xs !select-text",
          description: "!text-[11px] !text-muted-foreground !select-text",
          error: "!text-destructive",
          closeButton:
            "!left-auto !right-0 ![transform:translate(35%,-35%)] !bg-popover !text-muted-foreground !border-border hover:!bg-accent hover:!text-foreground",
        },
      }}
    />
  );
}
