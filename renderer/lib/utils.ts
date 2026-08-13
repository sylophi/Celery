import type { CSSProperties } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Title-bar drag region: a non-standard CSS property React's typed
// CSSProperties doesn't model; wrap the cast in one place.
export function dragRegion(value: "drag" | "no-drag"): CSSProperties {
  return { ["WebkitAppRegion" as never]: value };
}

export function displayName(fileName: string): string {
  return fileName.replace(/\.zip$/i, "");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes;
  let unit = "B";
  for (const next of units) {
    if (value < 1024) break;
    value /= 1024;
    unit = next;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${unit}`;
}
