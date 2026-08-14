import { useEffect, useState, type RefObject } from "react";

// True once the element has come within `rootMargin` of the scrolling
// area, and true forever after. The grid uses it to hold back per-mod
// metadata fetches until a tile is worth loading; latching means
// scrolling back over a tile costs nothing.
//
// `root` must be the scroller the element actually lives in. With the
// default (the viewport) `rootMargin` expands the viewport rect but the
// intermediate scroller still clips unexpanded, so the margin does
// nothing and tiles only load once already on screen.
export function useOnScreen(
  ref: RefObject<Element | null>,
  root: RefObject<Element | null>,
  rootMargin = "300px",
): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || seen) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { root: root.current, rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, root, seen, rootMargin]);
  return seen;
}
