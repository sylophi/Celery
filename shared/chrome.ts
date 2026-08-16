// Native window buttons, in the one place that knows about them.
//
// Both platforms overlay their buttons on the app's own toolbar, so the
// toolbar has to keep a corner clear — the leading one on macOS, the
// trailing one on Windows. Windows reports its own claim at runtime
// through the Window Controls Overlay, so only macOS needs numbers here:
// main positions the traffic lights, the renderer pads around them, and
// both read this file rather than each carrying a magic constant.

// The app's toolbar height, which both platforms' buttons are fitted
// to: Windows makes its caption strip this tall so the buttons centre
// in the row, macOS centres the traffic lights in it. The renderer
// reads it as `--toolbar-height`, so the three stay in step.
export const TOOLBAR_HEIGHT = 44;

// Three 14px buttons on a 20px pitch, then the same breathing room again
// before the app's own content starts.
const BUTTON = 14;
const PITCH = 20;
const GAP = 22;

export const TRAFFIC_LIGHT_POSITION = {
  x: 16,
  y: Math.round((TOOLBAR_HEIGHT - BUTTON) / 2),
};

export const TRAFFIC_LIGHT_INSET =
  TRAFFIC_LIGHT_POSITION.x + PITCH * 2 + BUTTON + GAP;

// The shell's colours: sRGB duplicates of the renderer's --background /
// --foreground tokens (renderer/index.css), which the native chrome
// needs before any CSS loads. Main paints the window background with
// them so resize flashes blend in, and Windows tints its caption
// buttons with them. Retune together with the tokens.
export const CHROME_COLORS = {
  light: { background: "#f6f5ff", foreground: "#1d1b38" },
  dark: { background: "#111023", foreground: "#f1f0fb" },
} as const;
