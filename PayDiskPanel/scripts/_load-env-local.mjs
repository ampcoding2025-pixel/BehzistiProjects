import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/** Load .env.local with quote strip + \$ unescape (Next/@next/env compatible). */
export function loadEnvLocal(fromFile = import.meta.url) {
  const root = path.resolve(path.dirname(fileURLToPath(fromFile)), "..");
  const raw = fs.readFileSync(path.join(root, ".env.local"), "utf8");
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        let val = l.slice(i + 1);
        if (
          (val.startsWith("'") && val.endsWith("'")) ||
          (val.startsWith('"') && val.endsWith('"'))
        ) {
          val = val.slice(1, -1);
        }
        val = val.replace(/\\\$/g, "$");
        return [l.slice(0, i), val];
      }),
  );
}
