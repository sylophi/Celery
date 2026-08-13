// Native window buttons, in the one place that knows about them.
//
// Both platforms overlay their buttons on the app's own toolbar, so the
// toolbar has to keep a corner clear — the leading one on macOS, the
// trailing one on Windows. Windows reports its own claim at runtime
// through the Window Controls Overlay, so only macOS needs numbers here:
// main positions the traffic lights, the renderer pads around them, and
// both read this file rather than each carrying a magic constant.

export const TRAFFIC_LIGHT_POSITION = { x: 16, y: 18 };

// Three 14px buttons on a 20px pitch, then the same breathing room again
// before the app's own content starts.
const BUTTON = 14;
const PITCH = 20;
const GAP = 22;

export const TRAFFIC_LIGHT_INSET =
  TRAFFIC_LIGHT_POSITION.x + PITCH * 2 + BUTTON + GAP;
