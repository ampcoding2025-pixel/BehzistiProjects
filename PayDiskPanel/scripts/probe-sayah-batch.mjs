import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  const v = line.slice(i + 1).trim();
  if (k.startsWith("PAYDISK_")) process.env[k] = v;
}

const { loadMostamariIbnCandidates } = await import(
  "../src/lib/sayah/candidates.ts"
);
const { customerHasShebaIdBatch } = await import("../src/lib/sayah/tatbigh.ts");

const { candidates, totalEligible } = await loadMostamariIbnCandidates(5);
console.log("eligible", totalEligible, "batch", candidates.length);
const batch = await customerHasShebaIdBatch(candidates, {
  limit: 5,
  delayMs: 200,
  timeoutMs: 20_000,
  mode: "rest",
});
console.log({
  checked: batch.checked,
  matchCount: batch.matchCount,
  mismatchCount: batch.mismatchCount,
  errorCount: batch.errorCount,
  transports: batch.transports,
});
for (const r of batch.rows) {
  console.log(
    r.nationalId,
    r.shebaId,
    "→",
    r.result.matched,
    r.result.message,
  );
}
