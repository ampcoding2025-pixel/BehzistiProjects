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

const trId = Number(process.argv[2] || 727);
const { labYaraneShebaDeviations } = await import(
  "../src/lib/sayah/yarane-deviations.ts"
);
const result = await labYaraneShebaDeviations(trId, {
  page: 1,
  pageSize: 15,
  sayahLimit: 10,
});
console.log({
  trId,
  message: result.message,
  missingCount: result.missingCount,
  sayahChecked: result.sayahChecked,
  sayahMatchCount: result.sayahMatchCount,
  sayahMismatchCount: result.sayahMismatchCount,
  sayahErrorCount: result.sayahErrorCount,
  rows: result.rows.length,
  ms: result.ms,
});
for (const r of result.rows.slice(0, 8)) {
  console.log(`${r.Center} | ${r.ibn || "—"} | ${r.sayahDeviation}`);
}
