import { parse } from "yaml";
import type { DependencyRef, ModEntry } from "@shared/schemas";

// Parses an everest.yaml manifest into normalized entries. Real-world
// manifests are messy: UTF-8 BOMs, CRLF, comments inside dependency
// lists, keys in any order, 2/4/6-space indentation, `---` document
// markers, numeric-looking versions (`1.6418` parses as a float), and
// trailing whitespace on values. The yaml package handles the syntax;
// normalization here handles the values.

function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return undefined;
}

function asDependencyList(value: unknown): DependencyRef[] {
  if (!Array.isArray(value)) return [];
  const out: DependencyRef[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const name = asString(record["Name"]);
    if (!name) continue;
    out.push({ name, version: asString(record["Version"]) ?? "0" });
  }
  return out;
}

export function parseEverestYaml(text: string): ModEntry[] {
  const cleaned = text.replace(/^﻿/, "");
  const doc: unknown = parse(cleaned);
  if (!Array.isArray(doc)) {
    throw new Error("manifest root is not a sequence");
  }
  const entries: ModEntry[] = [];
  for (const item of doc) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const name = asString(record["Name"]);
    if (!name) continue;
    entries.push({
      name,
      version: asString(record["Version"]) ?? "0",
      dll: asString(record["DLL"]),
      dependencies: asDependencyList(record["Dependencies"]),
      optionalDependencies: asDependencyList(record["OptionalDependencies"]),
    });
  }
  if (entries.length === 0) {
    throw new Error("manifest declares no mods");
  }
  return entries;
}
