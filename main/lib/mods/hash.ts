import { createReadStream } from "node:fs";
import xxhashInit from "xxhash-wasm";

// XXH64 (seed 0) of a whole file, streamed — the hash Everest's update
// database keys on, so local zips can be matched against it without
// trusting version strings. WASM instantiation happens once.

type XXHashApi = Awaited<ReturnType<typeof xxhashInit>>;
let apiPromise: Promise<XXHashApi> | null = null;

export async function hashFile(filePath: string): Promise<string> {
  apiPromise ??= xxhashInit();
  const { create64 } = await apiPromise;
  const hasher = create64();
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hasher.update(chunk as Buffer);
  }
  return hasher.digest().toString(16).padStart(16, "0");
}
