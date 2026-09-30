import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

/**
 * Every `@/…` import must resolve to a file that exists.
 *
 * Vitest resolves lazily, so a module deleted out from under an importer surfaces only as one spec
 * failing to collect — while `vite build` fails outright. This walks the source tree so a dangling
 * alias import is a test failure with the offending file named, rather than a broken build.
 */
const SRC = resolve(process.cwd(), "src");
const SOURCE_EXTENSIONS = [".ts", ".vue"];
const RESOLUTION_CANDIDATES = ["", ".ts", ".vue", ".js", "/index.ts", "/index.vue", "/index.js"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);

    return SOURCE_EXTENSIONS.some((ext) => path.endsWith(ext)) ? [path] : [];
  });
}

/** `from "@/x"` and `import("@/x")`, which is how every alias import in this app is written. */
const ALIAS_IMPORT = /(?:from\s+|import\s*\(\s*)["']@\/([^"']+)["']/g;

describe("alias imports", () => {
  it("resolves every @/ import to a file that exists", () => {
    const dangling: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const contents = readFileSync(file, "utf8");
      for (const [, specifier] of contents.matchAll(ALIAS_IMPORT)) {
        const target = join(SRC, specifier);
        if (!RESOLUTION_CANDIDATES.some((suffix) => existsSync(target + suffix))) {
          dangling.push(`${file.slice(SRC.length + 1)} imports @/${specifier}`);
        }
      }
    }

    expect(dangling).toEqual([]);
  });
});
