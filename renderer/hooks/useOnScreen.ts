import { useEffect, useState, type RefObject } from "react";

// True once the element has come within `rootMargin` of the viewport,
// and true forever after. The grid uses it to hold back per-mod
// metadata fetches until a tile is actually worth loading; latching
// means scrolling back over a tile costs nothing.
export function useOnScreen(
  ref: RefObject<Element | null>,
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
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, seen, rootMargin]);
  return seen;
}
